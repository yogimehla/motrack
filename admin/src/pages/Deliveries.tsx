import { useEffect, useMemo, useState } from 'react';
import { api, DELIVERY_STATUSES, type Delivery, type User } from '../api';
import { useToast } from '../toast';

interface OptimizeResult {
  order?: string[];
  ordered?: Delivery[];
  deliveries?: Delivery[];
  total_km?: number;
  legs?: { from: string; to: string; km?: number }[];
  [key: string]: unknown;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  assigned: 'bg-indigo-50 text-indigo-700',
  driver_accepted: 'bg-indigo-50 text-indigo-700',
  picked_up: 'bg-sky-50 text-sky-700',
  in_transit: 'bg-sky-50 text-sky-700',
  near_destination: 'bg-sky-50 text-sky-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-rose-50 text-rose-700',
  returned: 'bg-amber-50 text-amber-700',
};

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [route, setRoute] = useState<{ stops: Delivery[]; totalKm?: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/deliveries', {
        params: statusFilter ? { status: statusFilter } : {},
      });
      const list: Delivery[] = Array.isArray(res.data.data) ? res.data.data : res.data.data?.deliveries ?? [];
      setDeliveries(list);
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed to load deliveries', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    // Fetch drivers via deliveries? No — use analytics-free approach: users endpoint may not exist.
    // Per SPEC drivers are users with role=driver; there is no /users endpoint, so we
    // derive the driver list from /analytics/drivers (id + name).
    api
      .get('/analytics/drivers')
      .then((res) => {
        const rows: any[] = Array.isArray(res.data.data) ? res.data.data : res.data.data?.drivers ?? [];
        setDrivers(rows.map((r) => ({ id: r.driver_id ?? r.id, email: r.email ?? '', name: r.name, role: 'driver' })));
      })
      .catch(() => setDrivers([]));
  }, []);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assign = async (deliveryId: string, driverId: string) => {
    if (!driverId) return;
    try {
      await api.put(`/deliveries/${deliveryId}/assign`, { driver_id: Number(driverId) });
      toast('Driver assigned', 'success');
      load();
    } catch (e: any) {
      toast(e.response?.data?.error || 'Assign failed', 'error');
    }
  };

  const optimize = async () => {
    if (selected.size === 0) {
      toast('Select at least one delivery', 'error');
      return;
    }
    setOptimizing(true);
    setRoute(null);
    try {
      const first = deliveries.find((d) => selected.has(d.id));
      const start = first ? { lat: first.pickup.lat, lon: first.pickup.lon } : { lat: 30.75, lon: 76.78 };
      const res = await api.post('/deliveries/optimize', {
        delivery_ids: Array.from(selected),
        start,
      });
      const data: OptimizeResult = res.data.data;
      let stops: Delivery[] = [];
      if (Array.isArray(data.ordered)) stops = data.ordered;
      else if (Array.isArray(data.deliveries)) stops = data.deliveries;
      else if (Array.isArray(data.order)) {
        const byId = new Map(deliveries.map((d) => [d.id, d]));
        stops = data.order.map((id) => byId.get(id)).filter((d): d is Delivery => !!d);
      }
      setRoute({ stops, totalKm: data.total_km });
      toast('Route optimized', 'success');
    } catch (e: any) {
      toast(e.response?.data?.error || 'Optimize failed', 'error');
    } finally {
      setOptimizing(false);
    }
  };

  const selectedCount = useMemo(() => selected.size, [selected]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Deliveries</h2>
        <div className="flex items-center gap-3">
          <select className="input w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={optimize} disabled={optimizing || selectedCount === 0}>
            {optimizing ? 'Optimizing…' : `Optimize (${selectedCount})`}
          </button>
        </div>
      </div>

      {route && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Optimized Route {route.totalKm != null && <span className="text-slate-400 font-normal">· {route.totalKm.toFixed?.(1) ?? route.totalKm} km</span>}
            </h3>
            <button className="btn-secondary" onClick={() => setRoute(null)}>
              Close
            </button>
          </div>
          <ol className="space-y-2">
            {route.stops.map((d, i) => (
              <li key={d.id} className="flex items-center gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <span className="text-slate-700">{d.customer_name}</span>
                <span className="text-slate-400 truncate">{d.dropoff.address}</span>
              </li>
            ))}
            {route.stops.length === 0 && <li className="text-sm text-slate-400">No ordered stops returned.</li>}
          </ol>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Dropoff</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">COD</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Assign Driver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deliveries.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300"
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-700">{d.customer_name}</div>
                  <div className="text-xs text-slate-400">{d.customer_phone}</div>
                </td>
                <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{d.dropoff.address}</td>
                <td className="px-4 py-3 text-slate-600">{d.priority}</td>
                <td className="px-4 py-3 text-slate-600">{d.cod_amount != null ? `₹${d.cod_amount}` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[d.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {d.status}
                  </span>
                  {d.fail_reason && (
                    <div className="mt-1 text-xs text-rose-500 max-w-[140px] truncate" title={d.fail_reason}>
                      {d.fail_reason}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {d.created_at && (
                    <div>
                      <span className="font-medium text-slate-400">Created: </span>
                      {new Date(d.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  )}
                  {d.deadline && (() => {
                    const overdue = new Date(d.deadline) < new Date() && !['delivered','failed','returned'].includes(d.status);
                    return (
                      <div className={overdue ? 'text-rose-600 font-semibold' : ''}>
                        <span className="font-medium text-slate-400">Deadline: </span>
                        {new Date(d.deadline).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        {overdue && ' ⚠'}
                      </div>
                    );
                  })()}
                  {d.started_at && (
                    <div>
                      <span className="font-medium text-slate-400">Started: </span>
                      {new Date(d.started_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  )}
                  {d.completed_at && (
                    <div>
                      <span className="font-medium text-slate-400">Done: </span>
                      {new Date(d.completed_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    className="input w-44"
                    value={d.assigned_driver_id ?? ''}
                    onChange={(e) => assign(d.id, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {drivers.map((dr) => (
                      <option key={dr.id} value={dr.id}>
                        {dr.name || dr.email || dr.id}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {!loading && deliveries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No deliveries found.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
