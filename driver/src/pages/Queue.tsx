import { useCallback, useEffect, useState } from 'react';
import { api, asList, errorMessage, unwrap } from '../api';
import type { Delivery } from '../types';
import CompleteModal from '../components/CompleteModal';
import FailModal from '../components/FailModal';

function priorityBadge(p: number) {
  if (p >= 8) return 'bg-red-100 text-red-700';
  if (p >= 5) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-200 text-slate-600';
}

function Countdown({ deadline }: { deadline: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(deadline).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  return (
    <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-slate-500'}`}>
      {overdue ? 'Overdue by ' : '⏱ '}
      {h > 0 ? `${h}h ${m}m` : `${m}m`}
    </span>
  );
}

const ACTIVE_STATUSES = ['assigned', 'driver_accepted', 'picked_up', 'in_transit', 'near_destination'];

export default function Queue() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [completing, setCompleting] = useState<Delivery | null>(null);
  const [failing, setFailing] = useState<Delivery | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/deliveries', { params: { assigned_to: 'me' } });
      const list = asList<Delivery>(unwrap(res));
      list.sort((a, b) => b.priority - a.priority);
      setDeliveries(list);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (d: Delivery, action: 'accept' | 'start') => {
    setBusyId(d.id);
    setError('');
    setNotice('');
    try {
      await api.post(`/deliveries/${d.id}/${action}`, {});
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const failDelivery = async (reason: string) => {
    if (!failing) return;
    setBusyId(failing.id);
    setError('');
    try {
      await api.post(`/deliveries/${failing.id}/fail`, { reason });
      setFailing(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const optimize = async () => {
    setOptimizing(true);
    setError('');
    setNotice('');
    try {
      const active = deliveries.filter((d) => ACTIVE_STATUSES.includes(d.status));
      if (active.length < 2) {
        setNotice('Need at least 2 active deliveries to optimize.');
        return;
      }
      const start = await new Promise<{ lat: number; lon: number }>((resolve) => {
        if (!navigator.geolocation) return resolve({ lat: active[0].dropoff.lat, lon: active[0].dropoff.lon });
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => resolve({ lat: active[0].dropoff.lat, lon: active[0].dropoff.lon }),
          { timeout: 4000 },
        );
      });
      const res = await api.post('/deliveries/optimize', {
        delivery_ids: active.map((d) => d.id),
        start,
      });
      const data = unwrap<{ order?: unknown[]; legs?: unknown[]; total_km?: number }>(res);
      const order = (data.order || []) as unknown[];
      // order may be ids or delivery objects
      const orderedIds = order.map((o) =>
        typeof o === 'string' || typeof o === 'number' ? String(o) : String((o as { id?: string }).id),
      );
      const byId = new Map(deliveries.map((d) => [d.id, d]));
      const reordered: Delivery[] = [];
      for (const id of orderedIds) {
        const d = byId.get(id);
        if (d) {
          reordered.push(d);
          byId.delete(id);
        }
      }
      reordered.push(...byId.values());
      setDeliveries(reordered);
      // Persist ordered legs for the map polyline
      sessionStorage.setItem(
        'optimizedRoute',
        JSON.stringify({
          start,
          stopIds: orderedIds,
          legs: data.legs || [],
          total_km: data.total_km,
        }),
      );
      setNotice(
        `Route optimized${data.total_km != null ? ` — ${Number(data.total_km).toFixed(1)} km total` : ''}.`,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setOptimizing(false);
    }
  };

  const active = deliveries.filter((d) => ACTIVE_STATUSES.includes(d.status));
  const done = deliveries.filter((d) => !ACTIVE_STATUSES.includes(d.status) && d.status !== 'pending');

  const renderCard = (d: Delivery) => (
    <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800">{d.customer_name}</p>
          <p className="mt-0.5 text-sm text-slate-500">{d.dropoff.address}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityBadge(d.priority)}`}>
          P{d.priority}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
          {d.status.replace(/_/g, ' ')}
        </span>
        {d.cod_amount != null && d.cod_amount > 0 && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            COD ₹{d.cod_amount}
          </span>
        )}
        {d.deadline && <Countdown deadline={d.deadline} />}
      </div>
      <div className="mt-3 flex gap-2">
        {d.status === 'assigned' && (
          <button
            onClick={() => act(d, 'accept')}
            disabled={busyId === d.id}
            className="min-h-[48px] flex-1 rounded-lg bg-indigo-700 font-medium text-white disabled:opacity-50"
          >
            Accept
          </button>
        )}
        {d.status === 'driver_accepted' && (
          <button
            onClick={() => act(d, 'start')}
            disabled={busyId === d.id}
            className="min-h-[48px] flex-1 rounded-lg bg-indigo-700 font-medium text-white disabled:opacity-50"
          >
            Start
          </button>
        )}
        {['picked_up', 'in_transit', 'near_destination'].includes(d.status) && (
          <>
            <button
              onClick={() => setCompleting(d)}
              className="min-h-[48px] flex-1 rounded-lg bg-emerald-600 font-medium text-white"
            >
              Complete
            </button>
            <button
              onClick={() => setFailing(d)}
              disabled={busyId === d.id}
              className="min-h-[48px] flex-1 rounded-lg border border-red-300 bg-white font-medium text-red-600 disabled:opacity-50"
            >
              Fail
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Delivery Queue</h1>
        <button
          onClick={optimize}
          disabled={optimizing || loading}
          className="min-h-[44px] rounded-lg bg-slate-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {optimizing ? 'Optimizing…' : 'Optimize route'}
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="mb-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-700">{notice}</p>}
      {loading && <p className="py-8 text-center text-slate-500">Loading…</p>}

      {!loading && active.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          No active deliveries in your queue.
        </p>
      )}

      <div className="space-y-3">{active.map(renderCard)}</div>

      {done.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Completed / closed
          </h2>
          <div className="space-y-3 opacity-75">{done.map(renderCard)}</div>
        </>
      )}

      {completing && (
        <CompleteModal
          delivery={completing}
          onClose={() => setCompleting(null)}
          onCompleted={() => {
            setCompleting(null);
            load();
          }}
        />
      )}

      {failing && (
        <FailModal
          delivery={failing}
          onClose={() => setFailing(null)}
          onConfirm={failDelivery}
          busy={busyId === failing.id}
        />
      )}
    </div>
  );
}
