import { useEffect, useState } from 'react';
import { api, type Feedback } from '../api';

const BADGE: Record<string, string> = {
  like: 'bg-emerald-50 text-emerald-700',
  dislike: 'bg-rose-50 text-rose-700',
  rating: 'bg-indigo-50 text-indigo-700',
};

export default function FeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/feedback')
      .then((res) => {
        const list: Feedback[] = Array.isArray(res.data.data) ? res.data.data : res.data.data?.feedback ?? [];
        setItems(list);
      })
      .catch((e) => setError(e.response?.data?.error || e.message));
  }, []);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-800">Feedback</h2>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="card divide-y divide-slate-100">
        {items.map((f) => (
          <div key={f.id} className="px-5 py-4 flex items-start gap-4">
            <span
              className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[f.type] ?? 'bg-slate-100 text-slate-600'}`}
            >
              {f.type === 'rating' ? `★ ${f.rating ?? '-'}` : f.type}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-700">{f.comment || '—'}</p>
              <div className="mt-1 flex gap-3 text-xs text-slate-400">
                {f.delivery_id && <span>Delivery {f.delivery_id}</span>}
                {f.created_at && <span>{new Date(f.created_at).toLocaleString()}</span>}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && !error && <p className="px-5 py-8 text-center text-sm text-slate-400">No feedback yet.</p>}
      </div>
    </div>
  );
}
