import { Hono } from 'hono';
import { z } from 'zod';
import { authProvider } from '../adapters/auth/index.js';
import { db, publicUser, type UserRow } from '../db.js';
import { fail, getUser, ok, requireAuth } from '../http.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['admin', 'dispatcher', 'driver']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes = new Hono();

authRoutes.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return fail(c, parsed.error.issues.map((i) => i.message).join('; '));
  try {
    return ok(c, authProvider.register(parsed.data), 201);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('UNIQUE')) return fail(c, 'Email already registered', 409);
    throw e;
  }
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return fail(c, parsed.error.issues.map((i) => i.message).join('; '));
  try {
    return ok(c, authProvider.login(parsed.data.email, parsed.data.password));
  } catch {
    return fail(c, 'Invalid credentials', 401);
  }
});

authRoutes.post('/refresh', requireAuth, (c) => {
  const header = c.req.header('Authorization')!;
  const token = header.slice(7);
  try {
    return ok(c, authProvider.refresh(token));
  } catch {
    return fail(c, 'Invalid or expired token', 401);
  }
});

authRoutes.get('/me', requireAuth, (c) => ok(c, getUser(c)));

// Update the caller's own profile — currently just the home / route end point.
const endPointSchema = z.object({
  end_address: z.string().min(1),
  end_lat: z.number().gte(-90).lte(90),
  end_lon: z.number().gte(-180).lte(180),
  end_plus_code: z.string().optional(),
});

authRoutes.patch('/me', requireAuth, async (c) => {
  const parsed = endPointSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, parsed.error.issues.map((i) => i.message).join('; '));
  const { end_address, end_lat, end_lon, end_plus_code } = parsed.data;
  const id = getUser(c).id;
  db.prepare(
    'UPDATE users SET end_lat = ?, end_lon = ?, end_address = ?, end_plus_code = ? WHERE id = ?',
  ).run(end_lat, end_lon, end_address, end_plus_code ?? null, id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
  return ok(c, publicUser(user));
});
