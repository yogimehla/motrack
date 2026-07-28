import { useCallback, useEffect, useRef, useState } from 'react';
import { api, asList, errorMessage, unwrap } from '../api';
import type { Notification } from '../types';

/** localStorage key shared with TabBar's unread badge. */
export const NOTIFS_LAST_SEEN_KEY = 'notifsLastSeenId';

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  // Snapshot of last-seen id taken when the screen opened — drives "new" markers.
  const seenAtOpenRef = useRef<number>(Number(localStorage.getItem(NOTIFS_LAST_SEEN_KEY) || 0));

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      const list = asList<Notification>(unwrap(res));
      setItems(list);
      setError('');
      // Mark everything currently shown as seen so the tab badge clears.
      const maxId = list.reduce((m, n) => Math.max(m, n.id), 0);
      if (maxId > 0) localStorage.setItem(NOTIFS_LAST_SEEN_KEY, String(maxId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh when the app regains focus (driver switches back to the app).
  useEffect(() => {
    const onFocus = () => { if (!document.hidden) load(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-white px-4 py-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Notifications</h1>
          <p className="text-xs text-slate-500">{items.length} total</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing || loading}
          aria-label="Refresh notifications"
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-sm font-semibold text-slate-600 active:scale-95 disabled:opacity-50"
        >
          <span className={refreshing ? 'inline-block animate-spin' : ''}>🔄</span>
          Refresh
        </button>
      </div>

      <div className="px-4 pt-4">
        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
            <span>⚠</span><span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center py-12 text-slate-400">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
            <p className="text-sm">Loading notifications…</p>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-2xl">🔔</p>
            <p className="mt-2 font-semibold text-slate-600">No notifications yet</p>
            <p className="mt-1 text-sm text-slate-400">Assignment alerts and updates will appear here</p>
          </div>
        )}

        <div className="space-y-2">
          {items.map((n) => {
            const isNew = n.id > seenAtOpenRef.current;
            const isBroadcast = n.user_id == null;
            return (
              <div
                key={n.id}
                className={`rounded-xl bg-white p-4 shadow-sm ring-1 ${
                  isNew ? 'ring-indigo-200' : 'ring-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">{isBroadcast ? '📢' : '🔔'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-slate-800">{n.title}</p>
                      {isNew && (
                        <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
