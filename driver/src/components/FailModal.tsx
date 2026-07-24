import { useState } from 'react';
import type { Delivery } from '../types';

interface Props {
  delivery: Delivery;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy: boolean;
}

export default function FailModal({ delivery, onClose, onConfirm, busy }: Props) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-slate-50 p-5 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-slate-800">Mark as failed</h2>
        <p className="mt-1 text-sm text-slate-500">
          {delivery.customer_name} — {delivery.dropoff.address}
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">Failure reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Customer not available, wrong address…"
            autoFocus
            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-red-400 focus:outline-none"
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="min-h-[48px] flex-1 rounded-lg border border-slate-300 bg-white text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim() || 'unspecified')}
            disabled={busy}
            className="min-h-[48px] flex-1 rounded-lg bg-red-600 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Submitting…' : 'Confirm fail'}
          </button>
        </div>
      </div>
    </div>
  );
}
