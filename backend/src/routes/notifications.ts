import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db.js';
import { notifier } from '../adapters/notifier/index.js';
import { fail, getUser, ok, requireAuth, requireRole } from '../http.js';

const sendSchema = z.object({
  user_id: z.number().int().optional(), // omit = broadcast
  title: z.string().min(1),
  body: z.string().min(1),
});

export const notificationsRoutes = new Hono();
notificationsRoutes.use('*', requireAuth);

// Admin broadcast / targeted send.
notificationsRoutes.post('/send', requireRole('admin'), async (c) => {
  const parsed = sendSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'Body: {user_id?, title, body}');
  const { user_id, title, body } = parsed.data;
  if (user_id != null) {
    const u = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
    if (!u) return fail(c, 'user_id not found', 404);
  }
  await notifier.send(user_id ?? null, title, body);
  const row = db
    .prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 1')
    .get();
  return ok(c, row, 201);
});

// Own notifications (includes broadcasts).
notificationsRoutes.get('/', (c) => {
  const user = getUser(c);
  const rows = db
    .prepare(
      'SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC LIMIT 100'
    )
    .all(user.id);
  return ok(c, rows);
});
