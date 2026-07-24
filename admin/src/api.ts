import axios from 'axios';

export const TOKEN_KEY = 'muulroute_token';

export const api = axios.create({
  baseURL: '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'dispatcher' | 'driver';
  tier?: string;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface PlacePoint extends LatLon {
  address: string;
  plus_code?: string;
}

export interface Delivery {
  id: string;
  pickup: PlacePoint;
  dropoff: PlacePoint;
  customer_name: string;
  customer_phone: string;
  cod_amount?: number;
  weight_kg: number;
  priority: number;
  deadline?: string;
  time_window?: string;
  status: string;
  assigned_driver_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DashboardStats {
  activeDrivers: number;
  deliveriesToday: number;
  completed: number;
  avgMinutes: number;
  onTimeRate: number;
  revenueToday: number;
  costPerDelivery: number;
}

export interface DriverStats {
  driver_id: string;
  name: string;
  email?: string;
  tier?: string;
  assigned: number;
  completed: number;
  failed: number;
  onTimeRate: number;
  avgMinutes: number;
  [key: string]: unknown;
}

export interface Region {
  id: string;
  name: string;
  version: number;
  size_mb: number;
  bounds: number[];
  status: string;
  [key: string]: unknown;
}

export interface Feedback {
  id: string;
  delivery_id?: string;
  type: 'like' | 'dislike' | 'rating';
  rating?: number;
  comment?: string;
  created_at?: string;
}

export const DELIVERY_STATUSES = [
  'pending',
  'assigned',
  'driver_accepted',
  'picked_up',
  'in_transit',
  'near_destination',
  'delivered',
  'failed',
  'returned',
] as const;
