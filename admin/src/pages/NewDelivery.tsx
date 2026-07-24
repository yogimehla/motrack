import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { api } from '../api';
import { osmRasterStyle } from '../mapStyle';
import { useToast } from '../toast';

type PickTarget = 'pickup' | 'dropoff';

interface GeoResult {
  display_name?: string;
  name?: string;
  lat: number | string;
  lon: number | string;
  [key: string]: unknown;
}

interface PointState {
  address: string;
  lat: string;
  lon: string;
  plusCode: string;
}

const emptyPoint: PointState = { address: '', lat: '', lon: '', plusCode: '' };

export default function NewDelivery() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [weightKg, setWeightKg] = useState('1');
  const [priority, setPriority] = useState('5');
  const [deadline, setDeadline] = useState('');
  const [timeWindow, setTimeWindow] = useState('');

  const [pickup, setPickup] = useState<PointState>(emptyPoint);
  const [dropoff, setDropoff] = useState<PointState>(emptyPoint);
  const [pickTarget, setPickTarget] = useState<PickTarget>('dropoff');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const pickupMarker = useRef<maplibregl.Marker | null>(null);
  const dropoffMarker = useRef<maplibregl.Marker | null>(null);

  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: osmRasterStyle,
      center: [76.78, 30.75], // Chandigarh
      zoom: 12,
      attributionControl: { compact: false },
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('click', (e) => {
      const { lat, lng } = e.lngLat;
      void setPointFromMap(pickTargetRef.current, lat, lng);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickTargetRef = useRef<PickTarget>(pickTarget);
  useEffect(() => {
    pickTargetRef.current = pickTarget;
  }, [pickTarget]);

  const upsertMarker = (target: PickTarget, lat: number, lon: number) => {
    const map = mapRef.current;
    if (!map) return;
    const color = target === 'pickup' ? '#6366f1' : '#0ea5e9';
    const ref = target === 'pickup' ? pickupMarker : dropoffMarker;
    if (ref.current) {
      ref.current.setLngLat([lon, lat]);
    } else {
      ref.current = new maplibregl.Marker({ color }).setLngLat([lon, lat]).addTo(map);
    }
  };

  const fetchPlusCode = async (lat: number, lon: number): Promise<string> => {
    try {
      const res = await api.get('/geocode/pluscode', { params: { lat, lon } });
      const d = res.data.data;
      return d?.plus_code ?? d?.plusCode ?? d?.code ?? '';
    } catch {
      return '';
    }
  };

  const setPointFromMap = async (target: PickTarget, lat: number, lon: number) => {
    const setter = target === 'pickup' ? setPickup : setDropoff;
    setter((p) => ({ ...p, lat: lat.toFixed(6), lon: lon.toFixed(6) }));
    upsertMarker(target, lat, lon);
    const code = await fetchPlusCode(lat, lon);
    setter((p) => ({ ...p, plusCode: code }));
  };

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await api.get('/geocode/search', { params: { q: query } });
      const list: GeoResult[] = Array.isArray(res.data.data) ? res.data.data : res.data.data?.results ?? [];
      setResults(list);
    } catch (e: any) {
      toast(e.response?.data?.error || 'Geocode search failed', 'error');
    } finally {
      setSearching(false);
    }
  };

  const pickResult = async (r: GeoResult) => {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const address = r.display_name ?? r.name ?? query;
    const setter = pickTarget === 'pickup' ? setPickup : setDropoff;
    setter((p) => ({ ...p, address, lat: String(lat), lon: String(lon) }));
    upsertMarker(pickTarget, lat, lon);
    mapRef.current?.flyTo({ center: [lon, lat], zoom: 15 });
    setResults([]);
    const code = await fetchPlusCode(lat, lon);
    setter((p) => ({ ...p, plusCode: code }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/deliveries', {
        pickup: {
          address: pickup.address,
          lat: Number(pickup.lat),
          lon: Number(pickup.lon),
          ...(pickup.plusCode ? { plus_code: pickup.plusCode } : {}),
        },
        dropoff: {
          address: dropoff.address,
          lat: Number(dropoff.lat),
          lon: Number(dropoff.lon),
          ...(dropoff.plusCode ? { plus_code: dropoff.plusCode } : {}),
        },
        customer_name: customerName,
        customer_phone: customerPhone,
        cod_amount: codAmount ? Number(codAmount) : undefined,
        weight_kg: Number(weightKg),
        priority: Number(priority),
        deadline: deadline || undefined,
        time_window: timeWindow || undefined,
      });
      toast('Delivery created', 'success');
      navigate('/deliveries');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Failed to create delivery', 'error');
    } finally {
      setSaving(false);
    }
  };

  const pointFields = (label: string, target: PickTarget, point: PointState, setPoint: typeof setPickup) => (
    <fieldset className="card p-5 space-y-3">
      <legend className="text-sm font-semibold text-slate-700 px-1">{label}</legend>
      <div>
        <label className="label">Address</label>
        <input
          className="input"
          value={point.address}
          onChange={(e) => setPoint((p) => ({ ...p, address: e.target.value }))}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Latitude</label>
          <input
            className="input"
            type="number"
            step="any"
            value={point.lat}
            onChange={(e) => setPoint((p) => ({ ...p, lat: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="label">Longitude</label>
          <input
            className="input"
            type="number"
            step="any"
            value={point.lon}
            onChange={(e) => setPoint((p) => ({ ...p, lon: e.target.value }))}
            required
          />
        </div>
      </div>
      <div>
        <label className="label">Plus Code</label>
        <input className="input bg-slate-50" value={point.plusCode || '—'} readOnly />
      </div>
      <button
        type="button"
        className={`btn-secondary w-full ${pickTarget === target ? 'ring-2 ring-indigo-300 border-indigo-400' : ''}`}
        onClick={() => setPickTarget(target)}
      >
        {pickTarget === target ? 'Clicking map sets this point' : 'Set from map click'}
      </button>
    </fieldset>
  );

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-800">New Delivery</h2>
      <form onSubmit={submit} className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-5">
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Customer</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">COD (₹)</label>
                <input className="input" type="number" min="0" value={codAmount} onChange={(e) => setCodAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Weight (kg)</label>
                <input className="input" type="number" min="0" step="any" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} required />
              </div>
              <div>
                <label className="label">Priority (1-10)</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="10"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Deadline</label>
                <input className="input" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div>
                <label className="label">Time Window</label>
                <input
                  className="input"
                  placeholder="e.g. 10:00-13:00"
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                />
              </div>
            </div>
          </div>
          {pointFields('Pickup', 'pickup', pickup, setPickup)}
          {pointFields('Dropoff', 'dropoff', dropoff, setDropoff)}
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? 'Creating…' : 'Create Delivery'}
          </button>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6">
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Geocode Search</h3>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Search address or place…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void search();
                  }
                }}
              />
              <button type="button" className="btn-primary shrink-0" onClick={search} disabled={searching}>
                {searching ? '…' : 'Search'}
              </button>
            </div>
            {results.length > 0 && (
              <ul className="divide-y divide-slate-100 max-h-56 overflow-auto rounded-lg border border-slate-200">
                {results.map((r, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-indigo-50"
                      onClick={() => pickResult(r)}
                    >
                      {r.display_name ?? r.name ?? `${r.lat}, ${r.lon}`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-400">
              Results fill the currently selected point ({pickTarget}) and move its marker.
            </p>
          </div>
          <div className="card overflow-hidden">
            <div ref={mapContainer} className="h-96 w-full" />
            <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
              Click the map to set the {pickTarget} point. Tiles © OpenStreetMap contributors.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
