import { useEffect, useState } from 'react';
import { api, type DriverStats } from '../api';

export default function Drivers() {
  const [rows, setRows] = useState<DriverStats[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/analytics/drivers')
      .then((res) => {
        const list: DriverStats[] = Array.isArray(res.data.data) ? res.data.data : res.data.data?.drivers ?? [];
        setRows(list);
      })
      .catch((e) => setError(e.response?.data?.error || e.message));
  }, []);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-800">Drivers</h2>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3">Driver</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Completed</th>
              <th className="px-4 py-3">Failed</th>
              <th className="px-4 py-3">On-time Rate</th>
              <th className="px-4 py-3">Avg Minutes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.driver_id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-700">{r.name}</div>
                  {r.email && <div className="text-xs text-slate-400">{r.email}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                    {r.tier ?? 'free'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.assigned}</td>
                <td className="px-4 py-3 text-slate-600">{r.completed}</td>
                <td className="px-4 py-3 text-slate-600">{r.failed}</td>
                <td className="px-4 py-3 text-slate-600">{r.onTimeRate != null ? `${r.onTimeRate}%` : '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r.avgMinutes ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No driver stats available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
