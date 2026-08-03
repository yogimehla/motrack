import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, asList, unwrap } from '../api';
import type { Delivery, User } from '../types';
import EndPointPicker from '../components/EndPointPicker';

const FREE_TIER_DAILY_LIMIT = 10;

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0 });
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
        const todayDeliveries = list.filter((d) => {
          const anyD = d as Delivery & { created_at?: string; updated_at?: string };
          const stamp = anyD.created_at || anyD.updated_at;
          return stamp ? new Date(stamp).toDateString() === today : true;
        });

        setTodayCount(todayDeliveries.length);
        setStats({
          total: list.length,
          completed: list.filter((d) => d.status === 'delivered').length,
          failed: list.filter((d) => d.status === 'failed').length,
        });
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
  const successRate = stats.total > 0 ? Math.round(((stats.completed / stats.total) * 100)) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24">
      {error && (
        <div className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Header Card */}
      <div className="relative bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 pb-6 pt-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur text-2xl font-bold">
              {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-bold">{user?.name || 'Driver'}</p>
              <p className="text-indigo-100 text-sm">{user?.email || '—'}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold backdrop-blur ${
                isFree
                  ? 'bg-white/20 text-white'
                  : 'bg-yellow-300/30 text-yellow-50'
              }`}
            >
              {tier.toUpperCase()}
            </div>
            <button
              onClick={logout}
              className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 font-semibold text-white border border-red-600 transition-colors text-xs"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Daily Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Today</p>
            <p className="mt-2 text-3xl font-bold text-indigo-600">{count}</p>
            {isFree && (
              <p className="mt-1 text-xs text-slate-500">
                of {FREE_TIER_DAILY_LIMIT}
              </p>
            )}
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Success Rate</p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{successRate}%</p>
            <p className="mt-1 text-xs text-slate-500">
              {stats.completed} completed
            </p>
          </div>
        </div>

        {/* Free Tier Warning */}
        {isFree && count >= FREE_TIER_DAILY_LIMIT && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm font-medium text-amber-900">Daily limit reached</p>
            <p className="mt-1 text-xs text-amber-700">
              Upgrade to Pro tier for unlimited deliveries
            </p>
          </div>
        )}

        {/* Overview Stats */}
        <div className="mb-4 rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-4">Overview</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                <span className="text-sm text-slate-600">Total Deliveries</span>
              </div>
              <span className="font-semibold text-slate-800">{stats.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-sm text-slate-600">Completed</span>
              </div>
              <span className="font-semibold text-slate-800">{stats.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-sm text-slate-600">Failed</span>
              </div>
              <span className="font-semibold text-slate-800">{stats.failed}</span>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="mb-4 rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3 border-b border-slate-200">
            <p className="text-sm font-semibold text-slate-800">Account Details</p>
          </div>
          <div className="p-4 space-y-0 divide-y divide-slate-100">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">👤</span>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Role</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800 capitalize">{user?.role || 'driver'}</p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                {(user?.role || 'driver').toUpperCase()}
              </div>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">⭐</span>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Membership</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800 capitalize">{tier}</p>
                </div>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isFree
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {tier.toUpperCase()}
              </div>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-lg">✉️</span>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Email</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800 truncate">{user?.email || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Endpoints */}
        {user && <EndPointPicker user={user} onSaved={setUser} />}
      </div>
    </div>
  );
}
