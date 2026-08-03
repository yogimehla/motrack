import type { Delivery } from '../types';

interface DetailModalProps {
  delivery: Delivery | null;
  onClose: () => void;
}

export default function DetailModal({ delivery, onClose }: DetailModalProps) {
  if (!delivery) return null;

  const closedAt = delivery.completed_at || delivery.updated_at;
  const statusColors: Record<string, string> = {
    assigned: 'bg-blue-100 text-blue-700',
    driver_accepted: 'bg-purple-100 text-purple-700',
    picked_up: 'bg-indigo-100 text-indigo-700',
    in_transit: 'bg-cyan-100 text-cyan-700',
    near_destination: 'bg-sky-100 text-sky-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="w-full sm:max-w-sm max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-5 flex items-center justify-between text-white rounded-t-3xl">
          <div>
            <p className="text-sm font-medium text-indigo-100">Order Details</p>
            <p className="text-xl font-bold mt-1">{delivery.customer_name}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-white hover:bg-white/20 rounded-full p-2"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Key Info Row */}
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-3 border border-slate-200">
            <div>
              <p className="text-xs text-slate-500 font-semibold">Status</p>
              <p className={`text-sm font-bold mt-1 capitalize ${statusColors[delivery.status] || 'text-slate-600'}`}>
                {delivery.status.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 font-semibold">Priority</p>
              <p className="text-2xl font-bold text-indigo-600 mt-1">P{delivery.priority}</p>
            </div>
          </div>

          {/* Call Button */}
          {delivery.customer_phone && (
            <a
              href={`tel:${delivery.customer_phone}`}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors"
            >
              📞 Call {delivery.customer_phone}
            </a>
          )}

          {/* Locations */}
          <div className="space-y-2">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-1">📦 Pickup</p>
              <p className="text-sm font-medium text-slate-900">{delivery.pickup.address}</p>
              {delivery.pickup.lat && delivery.pickup.lon && (
                <p className="text-xs text-slate-400 mt-1">
                  {delivery.pickup.lat.toFixed(4)}, {delivery.pickup.lon.toFixed(4)}
                </p>
              )}
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-emerald-600 uppercase mb-1">📍 Dropoff</p>
              <p className="text-sm font-medium text-slate-900">{delivery.dropoff.address}</p>
              {delivery.dropoff.lat && delivery.dropoff.lon && (
                <p className="text-xs text-slate-400 mt-1">
                  {delivery.dropoff.lat.toFixed(4)}, {delivery.dropoff.lon.toFixed(4)}
                </p>
              )}
            </div>
          </div>

          {/* COD Amount */}
          {delivery.cod_amount != null && delivery.cod_amount > 0 && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-600 uppercase">💰 COD Amount</p>
              <p className="text-3xl font-bold text-emerald-700 mt-2">₹{delivery.cod_amount}</p>
            </div>
          )}

          {/* Weight & Other Info */}
          <div className="grid grid-cols-2 gap-2">
            {delivery.weight_kg && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-slate-600 uppercase">⚖️ Weight</p>
                <p className="text-lg font-bold text-slate-900 mt-1">{delivery.weight_kg} kg</p>
              </div>
            )}
            {delivery.deadline && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-600 uppercase">⏱ Deadline</p>
                <p className="text-xs font-bold text-amber-900 mt-1">
                  {new Date(delivery.deadline).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Fail Reason */}
          {delivery.fail_reason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-600 uppercase">❌ Fail Reason</p>
              <p className="text-sm text-red-700 mt-1 font-medium">{delivery.fail_reason}</p>
            </div>
          )}

          {/* Time Window */}
          {delivery.time_window && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-600 uppercase">🕐 Time Window</p>
              <p className="text-sm text-slate-700 mt-1 font-medium">{delivery.time_window}</p>
            </div>
          )}

          <div className="h-4"></div>
        </div>
      </div>
    </div>
  );
}
