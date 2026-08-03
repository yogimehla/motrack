import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api, errorMessage, unwrap } from '../api';
import type { Delivery } from '../types';

export default function ReceiveDelivery() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [delivery, setDelivery] = useState<Delivery | null>(null);

  // Fetch delivery from backend using ID from URL path or query parameters
  useEffect(() => {
    const loadDelivery = async () => {
      try {
        // Case 1: Path parameter (e.g., /delivery/123)
        if (id) {
          const res = await api.get(`/deliveries/${id}/public`);
          const deliveryData = unwrap<Delivery>(res);
          setDelivery(deliveryData);
          setLoading(false);
          return;
        }

        // Case 2: Query parameters (e.g., /delivery?orderId=...&customer=...)
        const hasQueryParams = Array.from(searchParams.keys()).length > 0;
        if (hasQueryParams) {
          // Build query string from search params
          const queryString = new URLSearchParams(searchParams).toString();
          const res = await api.get(`/deliveries/from-link?${queryString}`);
          const deliveryData = unwrap<Delivery>(res);
          setDelivery(deliveryData);
          setLoading(false);
          return;
        }

        // No ID or query params provided
        setError('No delivery ID or parameters provided');
        setLoading(false);
      } catch (err) {
        setError(errorMessage(err));
        setLoading(false);
      }
    };

    loadDelivery();
  }, [id, searchParams]);

  const handleAccept = async () => {
    if (!delivery) return;

    try {
      setLoading(true);
      // Call backend to accept delivery
      await api.post(`/deliveries/${delivery.id}/accept`, {});
      setAccepted(true);

      // Redirect to queue after 2 seconds with refresh flag
      setTimeout(() => {
        navigate('/', { state: { refreshQueue: true } });
      }, 2000);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  if (accepted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-green-50">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">✅</div>
          <h2 className="text-2xl font-bold text-green-900">Delivery Accepted!</h2>
          <p className="text-green-700 mt-2">Adding to your queue...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-spin">⏳</div>
          <h2 className="text-lg font-semibold text-gray-700">Loading delivery...</h2>
        </div>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50 p-4">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-900 mb-2">Unable to Load Delivery</h2>
          <p className="text-red-700 mb-6">{error || 'Delivery not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
          >
            Back to Queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 flex flex-col pb-24">
      {/* Header */}
      <div className="bg-blue-600 text-white rounded-lg p-4 mb-4 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🆕</span>
          <h1 className="text-xl font-bold">New Delivery from PWA</h1>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-blue-100 text-sm">Order: #{delivery.id}</p>
          {delivery.created_at && (
            <p className="text-blue-100 text-sm">
              🕐 {new Date(delivery.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          )}
        </div>
      </div>

      {/* Delivery Details */}
      <div className="bg-white rounded-lg shadow-md p-4 space-y-4 mb-4">
        {/* Pickup Location */}
        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-700 mb-2">🏪 Pickup Location</h3>
          <p className="text-gray-900">{delivery.pickup.address}</p>
          {delivery.pickup.lat && delivery.pickup.lon && (
            <p className="text-xs text-gray-500 font-mono mt-1">
              {delivery.pickup.lat.toFixed(6)}, {delivery.pickup.lon.toFixed(6)}
            </p>
          )}
        </div>

        {/* Customer Info */}
        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-700 mb-2">👤 Customer</h3>
          <p className="text-lg font-bold text-gray-900">{delivery.customer_name}</p>
          {delivery.customer_phone && (
            <p className="text-sm text-gray-600">📱 {delivery.customer_phone}</p>
          )}
        </div>

        {/* Delivery Address */}
        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-700 mb-2">📍 Delivery Address</h3>
          <p className="text-gray-900">{delivery.dropoff.address}</p>
          {delivery.dropoff.lat && delivery.dropoff.lon && (
            <p className="text-xs text-gray-500 font-mono mt-1">
              {delivery.dropoff.lat.toFixed(6)}, {delivery.dropoff.lon.toFixed(6)}
            </p>
          )}
        </div>

        {/* Order Details */}
        <div className="border-b pb-4">
          <h3 className="font-semibold text-gray-700 mb-2">📦 Order Details</h3>
          {delivery.cod_amount && (
            <p className="text-2xl font-bold text-green-600 mt-2">
              ₹{delivery.cod_amount.toFixed(2)}
            </p>
          )}
          {delivery.cod_amount && (
            <div className="mt-2 inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
              💵 Cash on Delivery
            </div>
          )}
        </div>

        {/* Location Map Link */}
        {delivery.dropoff.lat && delivery.dropoff.lon && (
          <div>
            <a
              href={`https://maps.google.com/?q=${delivery.dropoff.lat},${delivery.dropoff.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold"
            >
              🗺️ Open in Google Maps
              <span>→</span>
            </a>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-auto">
        <button
          onClick={() => navigate('/')}
          disabled={loading}
          className="flex-1 px-4 py-3 bg-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-400 transition-colors disabled:opacity-50"
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          disabled={loading}
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? '⏳ Processing...' : '✅ Accept Delivery'}
        </button>
      </div>

      {/* Footer Info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-gray-600 text-center">
        <p>✓ This delivery will be added to your queue</p>
      </div>
    </div>
  );
}
