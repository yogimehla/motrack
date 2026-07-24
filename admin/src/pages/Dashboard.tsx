import { useEffect, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api, DELIVERY_STATUSES, type DashboardStats, type Delivery, type Feedback } from '../api';

const PIE_COLORS = [
  '#6366f1', // indigo-500
  '#94a3b8', // slate-400
  '#38bdf8', // sky-400
  '#818cf8', // indigo-400
  '#64748b', // slate-500
  '#34d399', // emerald-400
  '#475569', // slate-600
  '#f43f5e', // rose-500
  '#a5b4fc', // indigo-300
];

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, d, f] = await Promise.all([
          api.get('/analytics/dashboard'),
          api.get('/deliveries'),
          api.get('/feedback').catch(() => ({ data: { data: [] } })),
        ]);
        setStats(s.data.data);
        const list: Delivery[] = Array.isArray(d.data.data) ? d.data.data : d.data.data?.deliveries ?? [];
        setDeliveries(list);
        const fb: Feedback[] = Array.isArray(f.data.data) ? f.data.data : f.data.data?.feedback ?? [];
        setFeedback(fb);
      } catch (e: any) {
        setError(e.response?.data?.error || e.message);
      }
    })();
  }, []);

  const statusCounts = DELIVERY_STATUSES.map((s) => ({
    name: s,
    value: deliveries.filter((d) => d.status === s).length,
  })).filter((s) => s.value > 0);

  const kpis: { label: string; value: string | number }[] = stats
    ? [
        { label: 'Active Drivers', value: stats.activeDrivers },
        { label: 'Deliveries Today', value: stats.deliveriesToday },
        { label: 'Completed', value: stats.completed },
        { label: 'Avg Minutes', value: stats.avgMinutes },
        { label: 'On-time Rate', value: `${stats.onTimeRate}%` },
        { label: 'Revenue Today', value: `₹${stats.revenueToday}` },
      ]
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-800">Dashboard</h2>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{k.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-800">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Deliveries by Status</h3>
          {statusCounts.length === 0 ? (
            <p className="text-sm text-slate-400">No delivery data.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusCounts} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                    {statusCounts.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Recent Feedback</h3>
          {feedback.length === 0 ? (
            <p className="text-sm text-slate-400">No feedback yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {feedback.slice(0, 8).map((f) => (
                <li key={f.id} className="py-2.5 flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      f.type === 'like'
                        ? 'bg-emerald-50 text-emerald-700'
                        : f.type === 'dislike'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-indigo-50 text-indigo-700'
                    }`}
                  >
                    {f.type === 'rating' ? `★ ${f.rating ?? '-'}` : f.type}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 truncate">{f.comment || '—'}</p>
                    {f.created_at && (
                      <p className="text-xs text-slate-400">{new Date(f.created_at).toLocaleString()}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
