import { z } from 'zod';
import type { IncomingOrder, IOrderSource } from './IOrderSource.js';

const schema = z.object({
  order_id: z.union([z.string(), z.number()]),
  store: z.object({
    lat: z.number(),
    lon: z.number(),
    address: z.string(),
  }),
  customer: z.object({
    name: z.string(),
    phone: z.string().optional(),
    address: z.string(),
    lat: z.number(),
    lon: z.number(),
  }),
  amount: z.number().nonnegative(),
  items: z.array(z.unknown()).optional(),
});

/**
 * ACTIVE: maps a MoInvoice order webhook payload to a Delivery
 * (cod_amount = amount, pickup = store).
 */
export class MoInvoiceOrderSource implements IOrderSource {
  readonly name = 'moinvoice';

  parse(raw: unknown): IncomingOrder[] {
    const o = schema.parse(raw);
    return [
      {
        external_order_id: String(o.order_id),
        pickup: { address: o.store.address, lat: o.store.lat, lon: o.store.lon },
        dropoff: { address: o.customer.address, lat: o.customer.lat, lon: o.customer.lon },
        customer_name: o.customer.name,
        customer_phone: o.customer.phone,
        cod_amount: o.amount,
        priority: 5,
      },
    ];
  }
}
