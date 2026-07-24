import { useState } from 'react';
import SignaturePad from './SignaturePad';
import { api, errorMessage } from '../api';
import type { Delivery } from '../types';

interface Props {
  delivery: Delivery;
  onClose: () => void;
  onCompleted: () => void;
}

export default function CompleteModal({ delivery, onClose, onCompleted }: Props) {
  const [signatureSvg, setSignatureSvg] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const getLocation = (): Promise<{ lat: number; lon: number } | undefined> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(undefined);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => resolve(undefined),
        { timeout: 4000 },
      );
    });

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const location = await getLocation();
      await api.post(`/deliveries/${delivery.id}/complete`, {
        signature_svg: signatureSvg,
        notes,
        location,
      });
      onCompleted();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-slate-50 p-5 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-slate-800">Complete delivery</h2>
        <p className="mt-1 text-sm text-slate-500">
          {delivery.customer_name} — {delivery.dropoff.address}
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">Recipient signature</label>
          <SignaturePad onChange={setSignatureSvg} />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-slate-600">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Delivery notes (optional)"
            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-indigo-400 focus:outline-none"
          />
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="min-h-[48px] flex-1 rounded-lg border border-slate-300 bg-white text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="min-h-[48px] flex-1 rounded-lg bg-indigo-700 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Submitting…' : 'Submit POD'}
          </button>
        </div>
      </div>
    </div>
  );
}
