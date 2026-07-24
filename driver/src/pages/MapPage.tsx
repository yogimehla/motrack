import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { api, asList, unwrap } from '../api';
import type { Delivery } from '../types';

const ACTIVE_STATUSES = ['assigned', 'driver_accepted', 'picked_up', 'in_transit', 'near_destination'];

interface RouteCache {
  start: { lat: number; lon: number };
  stopIds: string[];
}

function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Returns ordered [lon, lat] waypoints for OSRM: pos → pickup1 → dropoff1 → … */
function buildWaypoints(
  list: Delivery[],
  pos?: { lat: number; lon: number } | null,
): [number, number][] {
  const active = list.filter((d) => ACTIVE_STATUSES.includes(d.status));
  let ordered: Delivery[] = active;
  try {
    const cache = JSON.parse(sessionStorage.getItem('optimizedRoute') || 'null') as RouteCache | null;
    if (cache?.stopIds?.length) {
      const byId = new Map(active.map((d) => [d.id, d]));
      const fromCache = cache.stopIds.map((id) => byId.get(id)).filter(Boolean) as Delivery[];
      if (fromCache.length > 0) ordered = fromCache;
    }
  } catch { /* ignore */ }

  const coords: [number, number][] = [];
  if (pos) coords.push([pos.lon, pos.lat]);
  else if (ordered.length > 0) coords.push([ordered[0].pickup.lon, ordered[0].pickup.lat]);

  for (const d of ordered) {
    // Only visit pickup if driver hasn't collected yet
    if (['assigned', 'driver_accepted'].includes(d.status)) {
      coords.push([d.pickup.lon, d.pickup.lat]);
    }
    coords.push([d.dropoff.lon, d.dropoff.lat]);
  }
  return coords;
}

/** Fetch road geometry from OSRM public API. Returns GeoJSON coordinates. */
async function fetchRoadRoute(waypoints: [number, number][]): Promise<[number, number][]> {
  if (waypoints.length < 2) return waypoints;
  // Deduplicate adjacent identical points (OSRM rejects them)
  const unique = waypoints.filter(
    ([lon, lat], i) => i === 0 || lon !== waypoints[i - 1][0] || lat !== waypoints[i - 1][1],
  );
  if (unique.length < 2) return unique;
  const coords = unique.map(([lon, lat]) => `${lon},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const json = await res.json() as {
    routes?: Array<{ geometry: { coordinates: [number, number][] } }>;
  };
  return json.routes?.[0]?.geometry?.coordinates ?? unique;
}

function makeEl(css: string, text?: string) {
  const el = document.createElement('div');
  el.style.cssText = css;
  if (text) el.textContent = text;
  return el;
}

function makePulsingDot() {
  if (!document.getElementById('courier-pulse-style')) {
    const s = document.createElement('style');
    s.id = 'courier-pulse-style';
    s.textContent =
      '@keyframes courier-pulse{0%{transform:scale(1);opacity:.65}100%{transform:scale(2.8);opacity:0}}';
    document.head.appendChild(s);
  }
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:20px;height:20px';
  const ring = document.createElement('div');
  ring.style.cssText =
    'position:absolute;inset:-5px;border-radius:9999px;background:#2563eb;opacity:0;animation:courier-pulse 1.4s ease-out infinite';
  const dot = document.createElement('div');
  dot.style.cssText =
    'width:20px;height:20px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45)';
  wrap.appendChild(ring);
  wrap.appendChild(dot);
  return wrap;
}

export default function MapPage() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const courierRef = useRef<maplibregl.Marker | null>(null);
  const animRef = useRef<number>(0);
  const watchIdRef = useRef<number>(-1);
  const followRef = useRef(false);
  const nearSentRef = useRef(false);
  const deliveriesRef = useRef<Delivery[]>([]);
  const userPosRef = useRef<{ lat: number; lon: number } | null>(null);
  // Road geometry for simulation (fetched once per route)
  const roadCoordsRef = useRef<[number, number][]>([]);

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [maneuver, setManeuver] = useState('');
  const [nearDest, setNearDest] = useState(false);
  const [routeError, setRouteError] = useState('');

  useEffect(() => { deliveriesRef.current = deliveries; }, [deliveries]);

  // ── GeoJSON source helpers ───────────────────────────────────────────────
  const setRouteGeojson = useCallback((coords: [number, number][]) => {
    const src = mapRef.current?.getSource('route') as maplibregl.GeoJSONSource | undefined;
    src?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
  }, []);

  // ── Load deliveries ──────────────────────────────────────────────────────
  useEffect(() => {
    api
      .get('/deliveries', { params: { assigned_to: 'me' } })
      .then((res) => setDeliveries(asList<Delivery>(unwrap(res))))
      .catch(() => setDeliveries([]));
  }, []);

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [76.78, 30.73],
      zoom: 12,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      });
      // Casing (white outline) for visibility
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.6 },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#4338ca', 'line-width': 5, 'line-opacity': 0.9 },
      });
      setMapLoaded(true);
    });
    mapRef.current = map;
    return () => {
      cancelAnimationFrame(animRef.current);
      if (watchIdRef.current !== -1) navigator.geolocation?.clearWatch(watchIdRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Draw markers + fetch road route when ready ───────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const active = deliveries.filter((d) => ACTIVE_STATUSES.includes(d.status));
    for (const d of active) {
      // Pickup dot — only if driver hasn't collected yet
      if (['assigned', 'driver_accepted'].includes(d.status)) {
        const puEl = makeEl(
          'width:14px;height:14px;border-radius:9999px;background:#059669;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)',
        );
        markersRef.current.push(
          new maplibregl.Marker({ element: puEl })
            .setLngLat([d.pickup.lon, d.pickup.lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setText(`Pickup: ${d.pickup.address}`))
            .addTo(map),
        );
      }
      // Dropoff — priority badge (always shown)
      // Orange = not accepted yet (assigned), Indigo = accepted/active
      const isPending = d.status === 'assigned';
      const doEl = makeEl(
        `background:${isPending ? '#f97316' : '#4338ca'};color:#fff;border-radius:9999px;min-width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)`,
        `P${d.priority}`,
      );

      let popup: maplibregl.Popup;
      if (isPending) {
        const deliveryId = d.id;
        popup = new maplibregl.Popup({ offset: 20 }).setHTML(`
          <div style="min-width:180px;padding:4px 0">
            <p style="font-weight:700;margin:0 0 2px">${d.customer_name}</p>
            <p style="font-size:12px;color:#666;margin:0 0 6px">${d.dropoff.address}</p>
            <p style="font-size:11px;color:#f97316;font-weight:600;margin:0 0 10px">&#9679; Not accepted yet</p>
            <div style="display:flex;gap:8px">
              <button id="map-accept-${deliveryId}" style="flex:1;padding:8px 4px;background:#4338ca;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer">Accept</button>
              <button id="map-decline-${deliveryId}" style="flex:1;padding:8px 4px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer">Decline</button>
            </div>
          </div>
        `);
        popup.on('open', () => {
          document.getElementById(`map-accept-${deliveryId}`)?.addEventListener('click', async () => {
            try {
              await api.post(`/deliveries/${deliveryId}/accept`, {});
              popup.remove();
              const res = await api.get('/deliveries', { params: { assigned_to: 'me' } });
              setDeliveries(asList<Delivery>(unwrap(res)));
            } catch { /* ignore */ }
          });
          document.getElementById(`map-decline-${deliveryId}`)?.addEventListener('click', async () => {
            try {
              await api.post(`/deliveries/${deliveryId}/fail`, { reason: 'Driver declined' });
              popup.remove();
              const res = await api.get('/deliveries', { params: { assigned_to: 'me' } });
              setDeliveries(asList<Delivery>(unwrap(res)));
            } catch { /* ignore */ }
          });
        });
      } else {
        popup = new maplibregl.Popup({ offset: 20 }).setText(`${d.customer_name} — ${d.dropoff.address}`);
      }

      markersRef.current.push(
        new maplibregl.Marker({ element: doEl })
          .setLngLat([d.dropoff.lon, d.dropoff.lat])
          .setPopup(popup)
          .addTo(map),
      );
    }

    // Fit bounds
    if (active.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      for (const d of active) {
        if (['assigned', 'driver_accepted'].includes(d.status)) {
          bounds.extend([d.pickup.lon, d.pickup.lat]);
        }
        bounds.extend([d.dropoff.lon, d.dropoff.lat]);
      }
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 });
    }

    // Fetch road route
    const waypoints = buildWaypoints(deliveries, userPosRef.current);
    setRouteError('');
    fetchRoadRoute(waypoints)
      .then((roadCoords) => {
        roadCoordsRef.current = roadCoords;
        setRouteGeojson(roadCoords);
      })
      .catch(() => {
        // Fall back to straight lines
        roadCoordsRef.current = waypoints;
        setRouteGeojson(waypoints);
        setRouteError('Road routing unavailable — showing straight lines');
      });
  }, [deliveries, mapLoaded, setRouteGeojson]);

  // ── Position update (real GPS or simulation) ─────────────────────────────
  const onPosition = useCallback((lat: number, lon: number) => {
    const p = { lat, lon };
    userPosRef.current = p;

    const map = mapRef.current;
    if (map) {
      if (!courierRef.current) {
        courierRef.current = new maplibregl.Marker({
          element: makePulsingDot(),
        }).setLngLat([lon, lat]).addTo(map);
      } else {
        courierRef.current.setLngLat([lon, lat]);
      }
      if (followRef.current) map.easeTo({ center: [lon, lat], duration: 500 });
    }

    // Maneuver hint
    const active = deliveriesRef.current.filter((d) => ACTIVE_STATUSES.includes(d.status));
    if (active.length > 0) {
      const next = active[0];
      const needsPickup = ['assigned', 'driver_accepted'].includes(next.status);
      const target = needsPickup ? next.pickup : next.dropoff;
      const distM = haversineM(p, target);
      const label = needsPickup ? `pickup — ${next.pickup.address}` : next.customer_name;
      setManeuver(
        distM < 200
          ? `Approaching ${label} — ${Math.round(distM)} m`
          : `Head to ${label} — ${(distM / 1000).toFixed(1)} km`,
      );
      if (!needsPickup && distM < 200 && !nearSentRef.current) {
        nearSentRef.current = true;
        setNearDest(true);
      }
    }
  }, []);

  // ── Simulation along road geometry ───────────────────────────────────────
  const runSimulation = useCallback(() => {
    const coords = roadCoordsRef.current.length >= 2
      ? roadCoordsRef.current
      : buildWaypoints(deliveriesRef.current, userPosRef.current);
    if (coords.length < 2) return;

    const SEG_MS = 800; // faster per-segment for road (many small segments)
    let seg = 0;
    let segStart = performance.now();
    const step = (now: number) => {
      if (seg >= coords.length - 1) {
        setManeuver('You have arrived');
        setNavigating(false);
        followRef.current = false;
        return;
      }
      const t = Math.min(1, (now - segStart) / SEG_MS);
      const [lon1, lat1] = coords[seg];
      const [lon2, lat2] = coords[seg + 1];
      onPosition(lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t);
      if (t >= 1) { seg += 1; segStart = now; }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, [onPosition]);

  // ── Show current location dot immediately when map is ready ─────────────
  useEffect(() => {
    if (!mapLoaded || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onPosition(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [mapLoaded, onPosition]);

  const stopNav = () => {
    cancelAnimationFrame(animRef.current);
    if (watchIdRef.current !== -1) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = -1;
    }
    followRef.current = false;
    setNavigating(false);
    setManeuver('');
  };

  const startNav = () => {
    stopNav();
    nearSentRef.current = false;
    setNearDest(false);
    followRef.current = true;
    setNavigating(true);

    const beginNav = (startPos?: { lat: number; lon: number }) => {
      // Re-fetch road route from current position
      const waypoints = buildWaypoints(deliveriesRef.current, startPos ?? null);
      fetchRoadRoute(waypoints)
        .then((roadCoords) => {
          roadCoordsRef.current = roadCoords;
          setRouteGeojson(roadCoords);
        })
        .catch(() => {
          roadCoordsRef.current = waypoints;
          setRouteGeojson(waypoints);
        })
        .finally(() => {
          // Start real GPS watch; simulation is fallback
          if (navigator.geolocation) {
            watchIdRef.current = navigator.geolocation.watchPosition(
              (pos) => onPosition(pos.coords.latitude, pos.coords.longitude),
              () => {
                navigator.geolocation?.clearWatch(watchIdRef.current);
                watchIdRef.current = -1;
                runSimulation();
              },
              { enableHighAccuracy: true },
            );
          } else {
            runSimulation();
          }
        });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 15 });
          onPosition(p.lat, p.lon);
          beginNav(p);
        },
        () => beginNav(),
        { enableHighAccuracy: true, timeout: 5000 },
      );
    } else {
      beginNav();
    }
  };

  return (
    <div className="relative flex h-screen flex-col">
      {maneuver && (
        <div className="absolute left-3 right-3 top-3 z-30 rounded-xl bg-slate-800 p-3 text-sm font-medium text-white shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧭</span>
            <span>{maneuver}</span>
          </div>
        </div>
      )}
      {nearDest && (
        <div className="absolute left-3 right-3 top-16 z-30 rounded-xl bg-emerald-600 p-2 text-center text-sm font-semibold text-white shadow-lg">
          Near destination — status auto-set to near_destination
        </div>
      )}
      {routeError && (
        <div className="absolute bottom-24 left-3 right-3 z-30 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {routeError}
        </div>
      )}
      <div ref={mapEl} className="flex-1" />
      <div className="absolute bottom-20 left-3 right-3 z-30">
        <button
          onClick={navigating ? stopNav : startNav}
          className={`min-h-[52px] w-full rounded-xl font-semibold text-white shadow-lg ${
            navigating ? 'bg-red-600' : 'bg-indigo-700'
          }`}
        >
          {navigating ? 'Stop navigation' : 'Start navigation'}
        </button>
      </div>
    </div>
  );
}
