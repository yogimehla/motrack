export interface LatLon {
  lat: number;
  lon: number;
}

export interface Stop extends LatLon {
  address: string;
  plus_code?: string;
}

export type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'driver_accepted'
  | 'picked_up'
  | 'in_transit'
  | 'near_destination'
  | 'delivered'
  | 'failed'
  | 'returned';

export interface Delivery {
  id: string;
  pickup: Stop;
  dropoff: Stop;
  customer_name: string;
  customer_phone?: string;
  cod_amount?: number;
  weight_kg?: number;
  priority: number;
  deadline?: string;
  time_window?: string;
  status: DeliveryStatus;
  assigned_driver_id?: string;
  fail_reason?: string;
  completed_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tier?: 'free' | 'pro' | string;
  deliveries_today?: number;
}

export interface Region {
  id: string;
  name: string;
  version?: number | string;
  size_mb?: number;
  bounds?: number[];
}
