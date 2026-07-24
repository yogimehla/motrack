import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, asList, unwrap } from '../api';
import type { Delivery, User } from '../types';

const FREE_TIER_DAILY_LIMIT = 10;

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(unwrap<User>(res)))
      .catch((err) => setError(err.message));
    api
      .get('/deliveries', { params: { assigned_to: 'me' } })
      .then((res) => {
        const list = asList<Delivery>(unwrap(res));
        const today = new Date().toDateString();
        setTodayCount(
          list.filter((d) => {
            const anyD = d as Delivery & { created_at?: string; updated_at?: string };
            const stamp = anyD.created_at || anyD.updated_at;
            return stamp ? new Date(stamp).toDateString() === today : true;
          }).length,
        );
      })
      .catch(() => setTodayCount(null));
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  const tier = (user?.tier || 'free').toLowerCase();
  const isFree = tier === 'free';
  const count = user?.deliveries_today ?? todayCount ?? 0;

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold text-slate-800">Profile</h1>
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
            {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{user?.name || '—'}</p>
            <p className="text-sm text-slate-500">{user?.email || '—'}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isFree ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-700'
            }`}
          >
            {tier.toUpperCase()} tier
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            role: {user?.role || 'driver'}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-slate-600">Deliveries today</p>
        <p className="mt-1 text-3xl font-bold text-slate-800">
          {count}
          {isFree && <span className="text-lg font-medium text-slate-400"> / {FREE_TIER_DAILY_LIMIT}</span>}
        </p>
        {isFree && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            Free tier is limited to {FREE_TIER_DAILY_LIMIT} deliveries per day. Upgrade to Pro for
            unlimited deliveries.
          </p>
        )}
      </div>

      <button
        onClick={logout}
        className="mt-6 min-h-[48px] w-full rounded-lg border border-red-300 bg-white font-semibold text-red-600"
      >
        Log out
      </button>
    </div>
  );
}
