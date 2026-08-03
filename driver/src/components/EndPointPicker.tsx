import { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { api, errorMessage, unwrap } from '../api';
import type { User } from '../types';

interface GeoResult {
  lat: number | string;
  lon: number | string;
  display_name?: string;
  name?: string;
  plus_code?: string;
}

interface Draft {
  address: string;
  lat: number | null;
  lon: number | null;
  plusCode: string;
}

const CHANDIGARH: [number, number] = [76.78, 30.73];

/** House emoji marker anchored at its base, matching the driver map's marker style. */
function makeHomeMarker() {
  const el = document.createElement('div');
  el.style.cssText =
    'font-size:30px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))';
  el.textContent = '🏠';
  return el;
}

/**
 * Driver "end point" (home / route terminus) picker: geocode search + tap-to-set
 * on a MapLibre map, saved via PATCH /auth/me. Sized and styled for Android
 * (≥48dp targets, full-width actions, press feedback).
 */
export default function EndPointPicker({
  user,
  onSaved,
}: {
  user: User;
  onSaved: (u: User) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [draft, setDraft] = useState<Draft>({
    address: user.end_address ?? '',
    lat: typeof user.end_lat === 'number' ? user.end_lat : null,
    lon: typeof user.end_lon === 'number' ? user.end_lon : null,
    plusCode: user.end_plus_code ?? '',
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const upsertMarker = useCallback((lat: number, lon: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) markerRef.current.setLngLat([lon, lat]);
    else
      markerRef.current = new maplibregl.Marker({ element: makeHomeMarker(), anchor: 'bottom' })
        .setLngLat([lon, lat])
        .addTo(map);
  }, []);

  const setPointFromMap = useCallback(
    async (lat: number, lon: number) => {
      upsertMarker(lat, lon);
      setError('');
      setNotice('');
      setDraft((d) => ({ ...d, lat, lon }));
      try {
        const res = await api.get('/geocode/reverse', { params: { lat, lon } });
        const r = unwrap<GeoResult>(res);
        setDraft((d) => ({
          ...d,
          address: (r?.display_name as string) || `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
          plusCode: (r?.plus_code as string) || d.plusCode,
        }));
      } catch {
        setDraft((d) => ({
          ...d,
          address: d.address || `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
        }));
      }
    },
    [upsertMarker],
  );

  // Init map once.
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const hasPoint = draft.lat != null && draft.lon != null;
    const map = new maplibregl.Map({
      container: mapEl.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: hasPoint ? [draft.lon as number, draft.lat as number] : CHANDIGARH,
      zoom: hasPoint ? 14 : 12,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('click', (e) => void setPointFromMap(e.lngLat.lat, e.lngLat.lng));
    mapRef.current = map;
    if (hasPoint) upsertMarker(draft.lat as number, draft.lon as number);
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    setNotice('');
    try {
      const res = await api.get('/geocode/search', { params: { q: query } });
      const data = unwrap<GeoResult[] | { results?: GeoResult[] }>(res);
      const list = Array.isArray(data) ? data : data?.results ?? [];
      setResults(list);
      if (list.length === 0) setNotice('No results found.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: GeoResult) => {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setDraft({
      address: r.display_name ?? r.name ?? `${lat}, ${lon}`,
      lat,
      lon,
      plusCode: (r.plus_code as string) ?? '',
    });
    upsertMarker(lat, lon);
    mapRef.current?.flyTo({ center: [lon, lat], zoom: 15 });
    setResults([]);
    setNotice('');
  };

  const save = async () => {
    if (draft.lat == null || draft.lon == null) {
      setError('Pick a location first.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await api.patch('/auth/me', {
        end_address: draft.address || `${draft.lat.toFixed(6)}, ${draft.lon.toFixed(6)}`,
        end_lat: draft.lat,
        end_lon: draft.lon,
        end_plus_code: draft.plusCode || undefined,
      });
      onSaved(unwrap<User>(res));
      setNotice('End point saved.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 mb-32 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg">🏠</span>
        <p className="text-sm font-semibold text-slate-700">End point (home)</p>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Where your route finishes. Search or tap the map to set it — optimized routes return here.
      </p>

      {draft.address && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <p className="truncate text-sm text-slate-600">
            📍 {draft.address}
            {draft.plusCode ? <span className="text-slate-400"> · {draft.plusCode}</span> : null}
          </p>
          <button
            onClick={() => {
              setDraft({ address: '', lat: null, lon: null, plusCode: '' });
              if (markerRef.current) {
                markerRef.current.remove();
                markerRef.current = null;
              }
            }}
            className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
          >
            Clear
          </button>
        </div>
      )}

      {/* Search — kept above the map so the Android keyboard doesn't cover it. */}
      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Search address or place…"
          className="min-h-[48px] flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400"
        />
        <button
          onClick={search}
          disabled={searching || !query.trim()}
          className="min-h-[48px] shrink-0 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="mt-2 max-h-56 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onClick={() => pickResult(r)}
                className="flex min-h-[48px] w-full items-center px-3 py-2 text-left text-sm text-slate-600 active:bg-indigo-50"
              >
                <span className="truncate">{r.display_name ?? r.name ?? `${r.lat}, ${r.lon}`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
        <div ref={mapEl} className="h-72 w-full" />
        <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
          Tap the map to drop your home point. Tiles © OpenStreetMap contributors.
        </p>
      </div>

      {error && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {notice && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">{notice}</p>}

      <button
        onClick={save}
        disabled={saving || draft.lat == null || draft.lon == null}
        className="mt-3 min-h-[48px] w-full rounded-lg bg-indigo-700 font-semibold text-white shadow-sm active:scale-95 disabled:opacity-50"
      >
        {saving ? 'Saving…' : draft.address && user.end_address === draft.address ? 'Update end point' : 'Save end point'}
      </button>
    </div>
  );
}
