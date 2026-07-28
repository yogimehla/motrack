import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, asList, errorMessage, unwrap } from '../api';
import type { Delivery, User } from '../types';
import CompleteModal from '../components/CompleteModal';
import FailModal from '../components/FailModal';

const ACTIVE_STATUSES = ['assigned', 'driver_accepted', 'picked_up', 'in_transit', 'near_destination'];
const DONE_PAGE_SIZE = 5;
type Tab = 'queue' | 'closed';

function priorityBadge(p: number) {
  if (p >= 8) return 'bg-red-100 text-red-700 ring-1 ring-red-200';
  if (p >= 5) return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200';
  return 'bg-slate-100 text-slate-600';
}

/** Left accent bar colour by priority. */
function priorityBar(p: number) {
  if (p >= 8) return 'bg-red-500';
  if (p >= 5) return 'bg-amber-400';
  return 'bg-slate-300';
}

function statusStyle(s: string) {
  if (s === 'assigned') return 'bg-blue-50 text-blue-700';
  if (s === 'driver_accepted') return 'bg-violet-50 text-violet-700';
  if (s === 'picked_up' || s === 'in_transit') return 'bg-indigo-50 text-indigo-700';
  if (s === 'near_destination') return 'bg-cyan-50 text-cyan-700';
  if (s === 'delivered') return 'bg-emerald-50 text-emerald-700';
  if (s === 'failed') return 'bg-red-50 text-red-700';
  return 'bg-slate-100 text-slate-600';
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
    <span className={`flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-600' : 'text-slate-500'}`}>
      <span>{overdue ? '⚠ Overdue' : '⏱'}</span>
      <span>{h > 0 ? `${h}h ${m}m` : `${m}m`}</span>
    </span>
  );
}

export default function Queue() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [completing, setCompleting] = useState<Delivery | null>(null);
  const [failing, setFailing] = useState<Delivery | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [searchQueue, setSearchQueue] = useState('');
  const [searchDone, setSearchDone] = useState('');
  const [donePage, setDonePage] = useState(1);
  const [tab, setTab] = useState<Tab>('queue');

  useEffect(() => { window.scrollTo({ top: 0 }); }, [tab]);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/deliveries', { params: { assigned_to: 'me' } });
      const list = asList<Delivery>(unwrap(res));
      list.sort((a, b) => b.priority - a.priority);
      setDeliveries(list);
      setLastUpdated(Date.now());
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh: poll every 25s (silent — the big spinner only shows on first load)
  // and refresh when the driver returns to the app, so new assignments appear on their own.
  useEffect(() => {
    const t = setInterval(load, 25000);
    const onFocus = () => { if (!document.hidden) load(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
      if (active.length < 2) { setNotice('Need at least 2 active deliveries to optimize.'); return; }
      const start = await new Promise<{ lat: number; lon: number }>((resolve) => {
        if (!navigator.geolocation) return resolve({ lat: active[0].dropoff.lat, lon: active[0].dropoff.lon });
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => resolve({ lat: active[0].dropoff.lat, lon: active[0].dropoff.lon }),
          { timeout: 4000 },
        );
      });
      // Driver's saved home / end point — route returns here when set.
      let end: { lat: number; lon: number } | undefined;
      try {
        const me = unwrap<User>(await api.get('/auth/me'));
        if (typeof me.end_lat === 'number' && typeof me.end_lon === 'number') {
          end = { lat: me.end_lat, lon: me.end_lon };
        }
      } catch { /* optimize without a return leg */ }
      const res = await api.post('/deliveries/optimize', {
        delivery_ids: active.map((d) => d.id),
        start,
        ...(end ? { end } : {}),
      });
      const data = unwrap<{ order?: unknown[]; legs?: unknown[]; total_km?: number }>(res);
      const orderedIds = ((data.order || []) as unknown[]).map((o) =>
        typeof o === 'string' || typeof o === 'number' ? String(o) : String((o as { id?: string }).id),
      );
      const byId = new Map(deliveries.map((d) => [d.id, d]));
      const reordered: Delivery[] = [];
      for (const id of orderedIds) { const d = byId.get(id); if (d) { reordered.push(d); byId.delete(id); } }
      reordered.push(...byId.values());
      setDeliveries(reordered);
      sessionStorage.setItem('optimizedRoute', JSON.stringify({ start, stopIds: orderedIds, legs: data.legs || [], total_km: data.total_km }));
      setNotice(`Route optimized${data.total_km != null ? ` — ${Number(data.total_km).toFixed(1)} km total` : ''}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setOptimizing(false);
    }
  };

  const active = deliveries.filter((d) => ACTIVE_STATUSES.includes(d.status));
  const allDone = deliveries.filter((d) => !ACTIVE_STATUSES.includes(d.status) && d.status !== 'pending');

  const qQueue = searchQueue.trim().toLowerCase();
  const filteredActive = qQueue
    ? active.filter((d) =>
        d.customer_name.toLowerCase().includes(qQueue) ||
        d.dropoff.address.toLowerCase().includes(qQueue),
      )
    : active;

  const q = searchDone.trim().toLowerCase();
  const filteredDone = q
    ? allDone.filter((d) =>
        d.customer_name.toLowerCase().includes(q) ||
        d.dropoff.address.toLowerCase().includes(q) ||
        d.status.includes(q),
      )
    : allDone;

  const totalPages = Math.max(1, Math.ceil(filteredDone.length / DONE_PAGE_SIZE));
  const pagedDone = filteredDone.slice((donePage - 1) * DONE_PAGE_SIZE, donePage * DONE_PAGE_SIZE);

  const navigate = useNavigate();

  // 1-based stop order from the last Optimize run — shows a "Stop N" chip on cards.
  const optimizedOrder = useMemo(() => {
    const m = new Map<string, number>();
    try {
      const cache = JSON.parse(sessionStorage.getItem('optimizedRoute') || 'null') as
        | { stopIds?: string[] }
        | null;
      (cache?.stopIds || []).forEach((id, i) => m.set(String(id), i + 1));
    } catch { /* ignore */ }
    return m;
  }, [deliveries]);

  const searchValue = tab === 'queue' ? searchQueue : searchDone;
  const onSearchChange = (v: string) => {
    if (tab === 'queue') setSearchQueue(v);
    else { setSearchDone(v); setDonePage(1); }
  };

  const renderActiveCard = (d: Delivery) => {
    const stopNo = optimizedOrder.get(d.id);
    const started = ['picked_up', 'in_transit', 'near_destination'].includes(d.status);
    const prefix = d.status === 'assigned' || d.status === 'driver_accepted'; // heading to pickup first
    return (
      <div key={d.id} className="flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {/* Priority accent bar */}
        <div className={`w-1.5 shrink-0 ${priorityBar(d.priority)}`} />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {stopNo != null && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] font-bold text-white">
                    {stopNo}
                  </span>
                )}
                <p className="truncate text-base font-bold text-slate-900">{d.customer_name}</p>
              </div>
              <div className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
                <span className="mt-0.5 shrink-0">📍</span>
                <span className="line-clamp-2">
                  {prefix && <span className="font-medium text-slate-400">Pickup: </span>}
                  {prefix ? d.pickup.address : d.dropoff.address}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${priorityBadge(d.priority)}`}>
                P{d.priority}
              </span>
              {d.customer_phone && (
                <a
                  href={`tel:${d.customer_phone}`}
                  aria-label={`Call ${d.customer_name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 active:scale-95"
                >
                  📞
                </a>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(d.status)}`}>
              {d.status.replace(/_/g, ' ')}
            </span>
            {d.cod_amount != null && d.cod_amount > 0 && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                COD ₹{d.cod_amount}
              </span>
            )}
            {d.deadline && <Countdown deadline={d.deadline} />}
          </div>

          <div className="mt-4 flex gap-2">
            {d.status === 'assigned' && (
              <button
                onClick={() => act(d, 'accept')}
                disabled={busyId === d.id}
                className="min-h-[48px] flex-1 rounded-xl bg-indigo-600 font-semibold text-white shadow-sm active:scale-95 disabled:opacity-50"
              >
                {busyId === d.id ? 'Accepting…' : 'Accept'}
              </button>
            )}
            {d.status === 'driver_accepted' && (
              <button
                onClick={() => act(d, 'start')}
                disabled={busyId === d.id}
                className="min-h-[48px] flex-1 rounded-xl bg-violet-600 font-semibold text-white shadow-sm active:scale-95 disabled:opacity-50"
              >
                {busyId === d.id ? 'Starting…' : 'Start pickup'}
              </button>
            )}
            {started && (
              <>
                <button
                  onClick={() => setCompleting(d)}
                  className="min-h-[48px] flex-1 rounded-xl bg-emerald-600 font-semibold text-white shadow-sm active:scale-95"
                >
                  Complete
                </button>
                <button
                  onClick={() => setFailing(d)}
                  disabled={busyId === d.id}
                  className="min-h-[48px] flex-1 rounded-xl border border-red-200 bg-red-50 font-semibold text-red-600 active:scale-95 disabled:opacity-50"
                >
                  Fail
                </button>
              </>
            )}
            <button
              onClick={() => navigate('/map')}
              aria-label="Open on map"
              className="flex min-h-[48px] w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-600 active:scale-95"
            >
              🗺
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDoneCard = (d: Delivery) => {
    const closedAt = d.completed_at || d.updated_at;
    const closedLabel = closedAt
      ? new Date(closedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
      : null;
    return (
      <div key={d.id} className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-700">{d.customer_name}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">{d.dropoff.address}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle(d.status)}`}>
              {d.status.replace(/_/g, ' ')}
            </span>
            <span className={`text-xs font-bold ${priorityBadge(d.priority)} rounded-full px-2 py-0.5`}>
              P{d.priority}
            </span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {d.cod_amount != null && d.cod_amount > 0 && (
            <span className="text-xs text-emerald-600">COD ₹{d.cod_amount}</span>
          )}
          {d.fail_reason && (
            <span className="text-xs text-red-500">Reason: {d.fail_reason}</span>
          )}
          {closedLabel && (
            <span className="text-xs text-slate-400">{closedLabel}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white shadow-sm">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 px-4 pt-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Deliveries</h1>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {active.length} active · {allDone.length} closed
              {lastUpdated &&
                ` · updated ${new Date(lastUpdated).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing || loading}
            aria-label="Refresh deliveries"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-slate-500 active:scale-90 active:bg-slate-100 disabled:opacity-50"
          >
            <span className={refreshing ? 'inline-block animate-spin' : ''}>🔄</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex border-b border-slate-200">
          <button
            onClick={() => setTab('queue')}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
              tab === 'queue' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500'
            }`}
          >
            Queue
            {active.length > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tab === 'queue' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                {active.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('closed')}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
              tab === 'closed' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500'
            }`}
          >
            Completed / Closed
            {allDone.length > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tab === 'closed' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                {allDone.length}
              </span>
            )}
          </button>
        </div>

        {/* Search + Optimize */}
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5">
            <span className="text-sm text-slate-400">🔍</span>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search customer or address…"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
            />
            {searchValue && (
              <button onClick={() => onSearchChange('')} aria-label="Clear search" className="text-sm text-slate-400">
                ✕
              </button>
            )}
          </div>
          {tab === 'queue' && (
            <button
              onClick={optimize}
              disabled={optimizing || loading || active.length < 2}
              className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow active:scale-95 disabled:opacity-50"
            >
              <span>{optimizing ? '⏳' : '🗺'}</span>
              {optimizing ? '…' : 'Optimize'}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
            <span>⚠</span><span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700 ring-1 ring-indigo-200">
            <span>✓</span><span>{notice}</span>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-12 text-slate-400">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
            <p className="text-sm">Loading deliveries…</p>
          </div>
        )}

        {/* ── Queue tab ── */}
        {tab === 'queue' && !loading && (
          <>
            {filteredActive.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
                <p className="text-2xl">{searchQueue ? '🔍' : '📦'}</p>
                <p className="mt-2 font-semibold text-slate-600">
                  {searchQueue ? `No results for "${searchQueue}"` : 'No active deliveries'}
                </p>
                {!searchQueue && <p className="mt-1 text-sm text-slate-400">New assignments will appear here</p>}
              </div>
            )}
            <div className="space-y-3">{filteredActive.map(renderActiveCard)}</div>
          </>
        )}

        {/* ── Closed tab ── */}
        {tab === 'closed' && !loading && (
          <>
            {filteredDone.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
                <p className="text-2xl">{searchDone ? '🔍' : '✅'}</p>
                <p className="mt-2 font-semibold text-slate-600">
                  {searchDone ? `No results for "${searchDone}"` : 'No completed deliveries yet'}
                </p>
              </div>
            )}

            <div className="space-y-2">{pagedDone.map(renderDoneCard)}</div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => setDonePage((p) => Math.max(1, p - 1))}
                  disabled={donePage === 1}
                  className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="text-sm text-slate-500">{donePage} / {totalPages}</span>
                <button
                  onClick={() => setDonePage((p) => Math.min(totalPages, p + 1))}
                  disabled={donePage === totalPages}
                  className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {completing && (
        <CompleteModal
          delivery={completing}
          onClose={() => setCompleting(null)}
          onCompleted={() => { setCompleting(null); load(); }}
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
