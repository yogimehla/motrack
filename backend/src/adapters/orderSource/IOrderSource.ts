export interface IncomingOrder {
  external_order_id: string;
  pickup: { address: string; lat: number; lon: number };
  dropoff: { address: string; lat: number; lon: number };
  customer_name: string;
  customer_phone?: string;
  cod_amount?: number;
  weight_kg?: number;
  priority?: number;
}

export interface IOrderSource {
  readonly name: string;
  /** Parse a raw payload (JSON object or CSV text) into zero or more orders. */
  parse(raw: unknown): IncomingOrder[];
}
