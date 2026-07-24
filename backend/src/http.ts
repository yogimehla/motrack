import type { Context } from 'hono';
import { authProvider } from './adapters/auth/index.js';
import type { UserRow } from './db.js';

export type AuthUser = Omit<UserRow, 'password_hash'>;

export const ok = <T>(c: Context, data: T, status = 200) => c.json({ success: true, data }, status as never);
export const fail = (c: Context, error: string, status = 400) =>
  c.json({ success: false, error }, status as never);

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Bearer JWT middleware — populates c.get('user'). */
export async function requireAuth(c: Context, next: () => Promise<void>) {
  const header = c.req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(c, 'Missing Authorization bearer token', 401);
  try {
    const user = authProvider.verify(token);
    c.set('user', user);
    await next();
  } catch {
    return fail(c, 'Invalid or expired token', 401);
  }
}

/** Role guard middleware factory. */
export function requireRole(...roles: AuthUser['role'][]) {
  return async (c: Context, next: () => Promise<void>) => {
    const user = c.get('user') as AuthUser | undefined;
    if (!user) return fail(c, 'Unauthorized', 401);
    if (!roles.includes(user.role)) return fail(c, 'Forbidden: insufficient role', 403);
    await next();
  };
}

export function getUser(c: Context): AuthUser {
  return c.get('user') as AuthUser;
}
