import { Hono } from 'hono';
import { db } from '../db.js';
import { env } from '../env.js';
import { moInvoiceOrderSource, type IncomingOrder } from '../adapters/orderSource/index.js';
import { encode as plusEncode } from '../util/pluscode.js';
import { fail, ok } from '../http.js';
import { shapeDelivery } from './deliveries.js';

export const integrationsRoutes = new Hono();

/**
 * MoInvoice order webhook. Requires shared-secret header X-MoInvoice-Key.
 * Creates a Delivery (cod_amount=amount, pickup=store) and records order_events.
 */
integrationsRoutes.post('/moinvoice/order', async (c) => {
  const key = c.req.header('X-MoInvoice-Key');
  if (!key || key !== env.MOINVOICE_KEY) return fail(c, 'Invalid or missing X-MoInvoice-Key', 401);

  const body = await c.req.json().catch(() => null);
  if (!body) return fail(c, 'Invalid JSON body');

  let orders: IncomingOrder[];
  try {
    orders = moInvoiceOrderSource.parse(body);
  } catch (e) {
    return fail(c, `Invalid MoInvoice order payload: ${(e as Error).message}`);
  }
  const o = orders[0];

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO deliveries
         (pickup_address, pickup_lat, pickup_lon, pickup_plus_code,
          dropoff_address, dropoff_lat, dropoff_lon, dropoff_plus_code,
          customer_name, customer_phone, cod_amount, weight_kg, priority, status, source, external_order_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending','moinvoice',?)`
      )
      .run(
        o.pickup.address, o.pickup.lat, o.pickup.lon, plusEncode(o.pickup.lat, o.pickup.lon),
        o.dropoff.address, o.dropoff.lat, o.dropoff.lon, plusEncode(o.dropoff.lat, o.dropoff.lon),
        o.customer_name, o.customer_phone ?? null, o.cod_amount ?? null, o.weight_kg ?? 1,
        o.priority ?? 5, o.external_order_id
      );
    const deliveryId = info.lastInsertRowid;
    db.prepare(
      'INSERT INTO order_events (source, external_order_id, delivery_id, payload) VALUES (?,?,?,?)'
    ).run('moinvoice', o.external_order_id, deliveryId, JSON.stringify(body));
    return deliveryId;
  });

  const deliveryId = tx();
  return ok(
    c,
    {
      delivery: shapeDelivery(db.prepare('SELECT * FROM deliveries WHERE id = ?').get(deliveryId) as Record<string, unknown>),
      order_event: db
        .prepare('SELECT * FROM order_events WHERE delivery_id = ? ORDER BY id DESC LIMIT 1')
        .get(deliveryId),
    },
    201
  );
});
