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
  order_id?: string;
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
  created_at?: string;
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
  end_address?: string | null;
  end_lat?: number | null;
  end_lon?: number | null;
  end_plus_code?: string | null;
}

export interface Region {
  id: string;
  name: string;
  version?: number | string;
  size_mb?: number;
  bounds?: number[];
  created_at?: string;
}

export interface Notification {
  id: number;
  user_id: number | null;
  title: string;
  body: string;
  read: number | boolean;
  created_at: string;
}
