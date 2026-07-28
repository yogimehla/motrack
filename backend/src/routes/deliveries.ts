import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import { encode as plusEncode } from '../util/pluscode.js';
import { csvOrderSource, type IncomingOrder } from '../adapters/orderSource/index.js';
import { optimizer } from '../adapters/optimizer/index.js';
import { fail, getUser, ok, requireAuth, requireRole } from '../http.js';

export const FREE_TIER_DAILY_LIMIT = 10;

const STATUSES = [
  'pending', 'assigned', 'driver_accepted', 'picked_up', 'in_transit',
  'near_destination', 'delivered', 'failed', 'returned',
] as const;

const createSchema = z.object({
  pickup: z.object({
    address: z.string(),
    lat: z.number(),
    lon: z.number(),
    plus_code: z.string().optional(),
  }),
  dropoff: z.object({
    address: z.string(),
    lat: z.number(),
    lon: z.number(),
    plus_code: z.string().optional(),
  }),
  customer_name: z.string().min(1),
  customer_phone: z.string().optional(),
  cod_amount: z.number().nonnegative().optional(),
  weight_kg: z.number().positive().default(1),
  priority: z.number().int().min(1).max(10).default(5),
  deadline: z.string().optional(),
  time_window: z.string().optional(),
  assigned_driver_id: z.number().int().optional(),
});

const assignSchema = z.object({ driver_id: z.number().int() });
const failSchema = z.object({ reason: z.string().min(1) });
const completeSchema = z.object({
  signature_svg: z.string().optional(),
  photo_base64: z.string().optional(),
  notes: z.string().optional(),
  otp: z.string().optional(),
  location: z.object({ lat: z.number(), lon: z.number() }).optional(),
});
const feedbackSchema = z.object({
  type: z.enum(['like', 'dislike', 'rating']),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
});
const optimizeSchema = z.object({
  delivery_ids: z.array(z.number().int()).min(1),
  start: z.object({ lat: z.number(), lon: z.number() }),
  end: z.object({ lat: z.number(), lon: z.number() }).optional(),
});

function insertDelivery(o: IncomingOrder & { source?: string }, extra: Partial<Record<string, unknown>> = {}) {
  const info = db
    .prepare(
      `INSERT INTO deliveries
       (pickup_address, pickup_lat, pickup_lon, pickup_plus_code,
        dropoff_address, dropoff_lat, dropoff_lon, dropoff_plus_code,
        customer_name, customer_phone, cod_amount, weight_kg, priority,
        deadline, time_window, status, assigned_driver_id, source, external_order_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      o.pickup.address, o.pickup.lat, o.pickup.lon, plusEncode(o.pickup.lat, o.pickup.lon),
      o.dropoff.address, o.dropoff.lat, o.dropoff.lon, plusEncode(o.dropoff.lat, o.dropoff.lon),
      o.customer_name, o.customer_phone ?? null, o.cod_amount ?? null, o.weight_kg ?? 1,
      o.priority ?? 5, (extra.deadline as string) ?? null, (extra.time_window as string) ?? null,
      extra.assigned_driver_id ? 'assigned' : 'pending',
      (extra.assigned_driver_id as number) ?? null,
      o.source ?? 'manual', o.external_order_id ?? null
    );
  return db.prepare('SELECT * FROM deliveries WHERE id = ?').get(info.lastInsertRowid);
}

function getDelivery(id: number) {
  return db.prepare('SELECT * FROM deliveries WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
}

/** Reshape flat DB row into nested pickup/dropoff objects the frontend expects. */
export function shapeDelivery(row: Record<string, unknown>) {
  const { pickup_address, pickup_lat, pickup_lon, pickup_plus_code,
          dropoff_address, dropoff_lat, dropoff_lon, dropoff_plus_code,
          ...rest } = row;
  return {
    ...rest,
    pickup: { address: pickup_address, lat: pickup_lat, lon: pickup_lon, plus_code: pickup_plus_code },
    dropoff: { address: dropoff_address, lat: dropoff_lat, lon: dropoff_lon, plus_code: dropoff_plus_code },
  };
}

/** Free-tier enforcement: drivers with tier=free may accept max 10 deliveries/day. */
function acceptedToday(driverId: number): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM deliveries
       WHERE assigned_driver_id = ? AND accepted_at IS NOT NULL AND date(accepted_at) = date('now')`
    )
    .get(driverId) as { c: number };
  return row.c;
}

export const deliveriesRoutes = new Hono();
deliveriesRoutes.use('*', requireAuth);

// Create (dispatcher/admin)
deliveriesRoutes.post('/', requireRole('dispatcher', 'admin'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return fail(c, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const d = parsed.data;
  if (d.assigned_driver_id) {
    const drv = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'driver'").get(d.assigned_driver_id);
    if (!drv) return fail(c, 'assigned_driver_id is not a driver');
  }
  const row = insertDelivery(
    {
      external_order_id: '',
      pickup: d.pickup,
      dropoff: d.dropoff,
      customer_name: d.customer_name,
      customer_phone: d.customer_phone,
      cod_amount: d.cod_amount,
      weight_kg: d.weight_kg,
      priority: d.priority,
      source: 'manual',
    },
    { deadline: d.deadline, time_window: d.time_window, assigned_driver_id: d.assigned_driver_id }
  );
  return ok(c, shapeDelivery(row as Record<string, unknown>), 201);
});

// List — role-filtered: drivers see their own (or ?assigned_to=me for anyone)
deliveriesRoutes.get('/', (c) => {
  const user = getUser(c);
  const status = c.req.query('status');
  const assignedTo = c.req.query('assigned_to');
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status) {
    if (!(STATUSES as readonly string[]).includes(status)) return fail(c, `Invalid status '${status}'`);
    clauses.push('status = ?');
    params.push(status);
  }
  if (user.role === 'driver' || assignedTo === 'me') {
    clauses.push('assigned_driver_id = ?');
    params.push(user.id);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM deliveries ${where} ORDER BY priority DESC, id ASC`)
    .all(...params) as Record<string, unknown>[];
  return ok(c, rows.map(shapeDelivery));
});

deliveriesRoutes.get('/:id', (c) => {
  const id = Number(c.req.param('id'));
  const row = getDelivery(id);
  if (!row) return fail(c, 'Delivery not found', 404);
  const user = getUser(c);
  if (user.role === 'driver' && row.assigned_driver_id !== user.id) {
    return fail(c, 'Forbidden: not your delivery', 403);
  }
  return ok(c, shapeDelivery(row));
});

// Assign driver (dispatcher/admin)
deliveriesRoutes.put('/:id/assign', requireRole('dispatcher', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const row = getDelivery(id);
  if (!row) return fail(c, 'Delivery not found', 404);
  const parsed = assignSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'Body must be {driver_id: number}');
  const drv = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'driver'").get(parsed.data.driver_id);
  if (!drv) return fail(c, 'driver_id is not a driver');
  db.prepare(
    "UPDATE deliveries SET assigned_driver_id = ?, status = 'assigned', updated_at = datetime('now') WHERE id = ?"
  ).run(parsed.data.driver_id, id);
  return ok(c, shapeDelivery(getDelivery(id)!));
});

// Driver accepts
deliveriesRoutes.post('/:id/accept', requireRole('driver'), (c) => {
  const id = Number(c.req.param('id'));
  const row = getDelivery(id);
  if (!row) return fail(c, 'Delivery not found', 404);
  const user = getUser(c);
  if (row.assigned_driver_id !== user.id) return fail(c, 'Forbidden: not assigned to you', 403);
  if (row.status !== 'assigned' && row.status !== 'pending') {
    return fail(c, `Cannot accept delivery in status '${row.status}'`, 409);
  }
  if (user.tier === 'free' && acceptedToday(user.id) >= FREE_TIER_DAILY_LIMIT) {
    return fail(
      c,
      `Free tier limit reached: max ${FREE_TIER_DAILY_LIMIT} accepted deliveries per day. Upgrade to pro.`,
      402
    );
  }
  db.prepare(
    "UPDATE deliveries SET status = 'driver_accepted', accepted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(id);
  return ok(c, shapeDelivery(getDelivery(id)!));
});

// Driver starts (picked up / on the way)
deliveriesRoutes.post('/:id/start', requireRole('driver'), (c) => {
  const id = Number(c.req.param('id'));
  const row = getDelivery(id);
  if (!row) return fail(c, 'Delivery not found', 404);
  const user = getUser(c);
  if (row.assigned_driver_id !== user.id) return fail(c, 'Forbidden: not assigned to you', 403);
  if (row.status !== 'driver_accepted' && row.status !== 'picked_up') {
    return fail(c, `Cannot start delivery in status '${row.status}'`, 409);
  }
  db.prepare(
    "UPDATE deliveries SET status = 'in_transit', started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(id);
  return ok(c, shapeDelivery(getDelivery(id)!));
});

// Driver fails
deliveriesRoutes.post('/:id/fail', requireRole('driver'), async (c) => {
  const id = Number(c.req.param('id'));
  const row = getDelivery(id);
  if (!row) return fail(c, 'Delivery not found', 404);
  const user = getUser(c);
  if (row.assigned_driver_id !== user.id) return fail(c, 'Forbidden: not assigned to you', 403);
  const parsed = failSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'Body must be {reason: string}');
  db.prepare(
    "UPDATE deliveries SET status = 'failed', fail_reason = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(parsed.data.reason, id);
  return ok(c, shapeDelivery(getDelivery(id)!));
});

// Driver completes with POD
deliveriesRoutes.post('/:id/complete', requireRole('driver'), async (c) => {
  const id = Number(c.req.param('id'));
  const row = getDelivery(id);
  if (!row) return fail(c, 'Delivery not found', 404);
  const user = getUser(c);
  if (row.assigned_driver_id !== user.id) return fail(c, 'Forbidden: not assigned to you', 403);
  if (row.status === 'delivered') return fail(c, 'Delivery already completed', 409);
  const parsed = completeSchema.safeParse((await c.req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return fail(c, parsed.error.issues.map((i) => i.message).join('; '));
  db.prepare(
    "UPDATE deliveries SET status = 'delivered', pod = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).run(JSON.stringify(parsed.data), id);
  return ok(c, shapeDelivery(getDelivery(id)!));
});

// Feedback for a delivery
deliveriesRoutes.post('/:id/feedback', async (c) => {
  const id = Number(c.req.param('id'));
  const row = getDelivery(id);
  if (!row) return fail(c, 'Delivery not found', 404);
  const parsed = feedbackSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'Body: {type: like|dislike|rating, rating?, comment?}');
  const user = getUser(c);
  const info = db
    .prepare('INSERT INTO feedback (delivery_id, user_id, type, rating, comment) VALUES (?,?,?,?,?)')
    .run(id, user.id, parsed.data.type, parsed.data.rating ?? null, parsed.data.comment ?? null);
  return ok(c, db.prepare('SELECT * FROM feedback WHERE id = ?').get(info.lastInsertRowid), 201);
});

// Bulk CSV import (dispatcher/admin)
deliveriesRoutes.post('/bulk', requireRole('dispatcher', 'admin'), async (c) => {
  const text = await c.req.text();
  let orders: IncomingOrder[];
  try {
    orders = csvOrderSource.parse(text);
  } catch (e) {
    return fail(c, (e as Error).message);
  }
  if (orders.length === 0) return fail(c, 'CSV contained no data rows');
  const created = orders.map((o) => shapeDelivery(insertDelivery({ ...o, source: 'csv' }) as Record<string, unknown>));
  return ok(c, { created: created.length, deliveries: created }, 201);
});

// Optimize route
deliveriesRoutes.post('/optimize', async (c) => {
  const parsed = optimizeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'Body: {delivery_ids: number[], start: {lat, lon}}');
  const { delivery_ids, start, end } = parsed.data;
  const placeholders = delivery_ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT id, dropoff_lat, dropoff_lon FROM deliveries WHERE id IN (${placeholders})`)
    .all(...delivery_ids) as { id: number; dropoff_lat: number; dropoff_lon: number }[];
  const missing = delivery_ids.filter((id) => !rows.some((r) => r.id === id));
  if (missing.length) return fail(c, `Unknown delivery ids: ${missing.join(', ')}`, 404);
  const result = optimizer.optimize(
    rows.map((r) => ({ id: r.id, lat: r.dropoff_lat, lon: r.dropoff_lon })),
    start,
    end
  );
  return ok(c, { ...result, optimizer: optimizer.name });
});
