import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import { fail, getUser, ok, requireAuth } from '../http.js';

const schema = z.object({
  delivery_id: z.number().int().optional(),
  type: z.enum(['like', 'dislike', 'rating']),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
});

export const feedbackRoutes = new Hono();
feedbackRoutes.use('*', requireAuth);

feedbackRoutes.post('/', async (c) => {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'Body: {delivery_id?, type: like|dislike|rating, rating?, comment?}');
  const user = getUser(c);
  const info = db
    .prepare('INSERT INTO feedback (delivery_id, user_id, type, rating, comment) VALUES (?,?,?,?,?)')
    .run(parsed.data.delivery_id ?? null, user.id, parsed.data.type, parsed.data.rating ?? null, parsed.data.comment ?? null);
  return ok(c, db.prepare('SELECT * FROM feedback WHERE id = ?').get(info.lastInsertRowid), 201);
});

// One-tap quick feedback (like/dislike only).
feedbackRoutes.post('/quick', async (c) => {
  const parsed = schema
    .pick({ delivery_id: true })
    .extend({ type: z.enum(['like', 'dislike']) })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'Body: {delivery_id?, type: like|dislike}');
  const user = getUser(c);
  const info = db
    .prepare('INSERT INTO feedback (delivery_id, user_id, type) VALUES (?,?,?)')
    .run(parsed.data.delivery_id ?? null, user.id, parsed.data.type);
  return ok(c, db.prepare('SELECT * FROM feedback WHERE id = ?').get(info.lastInsertRowid), 201);
});

feedbackRoutes.get('/', (c) => {
  const rows = db
    .prepare(
      `SELECT f.*, u.name AS user_name FROM feedback f
       LEFT JOIN users u ON u.id = f.user_id
       ORDER BY f.id DESC LIMIT 200`
    )
    .all();
  return ok(c, rows);
});
