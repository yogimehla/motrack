import { Hono } from 'hono';
import { z } from 'zod';
import { authProvider } from '../adapters/auth/index.js';
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
