import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, publicUser, type UserRow } from '../../db.js';
import { env } from '../../env.js';
import type { AuthResult, IAuthProvider } from './IAuthProvider.js';

/** ACTIVE auth provider: email + password (bcryptjs) with JWT HS256. */
export class EmailPasswordProvider implements IAuthProvider {
  readonly name = 'email-password';

  private sign(u: UserRow): string {
    return jwt.sign({ sub: u.id, email: u.email, role: u.role, tier: u.tier }, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '12h',
    });
  }

  register(input: { email: string; password: string; name: string; role?: string }): AuthResult {
    const role = (input.role as UserRow['role']) || 'driver';
    const hash = bcrypt.hashSync(input.password, 10);
    const info = db
      .prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)')
      .run(input.email.toLowerCase(), hash, input.name, role);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as UserRow;
    return { user: publicUser(user), token: this.sign(user) };
  }

  login(email: string, password: string): AuthResult {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as
      | UserRow
      | undefined;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    }
    return { user: publicUser(user), token: this.sign(user) };
  }

  verify(token: string): Omit<UserRow, 'password_hash'> {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as unknown as {
        sub: number;
      };
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(payload.sub)) as
        | UserRow
        | undefined;
      if (!user) throw new Error('user gone');
      return publicUser(user);
    } catch {
      throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
    }
  }

  refresh(token: string): AuthResult {
    const pub = this.verify(token);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(pub.id) as UserRow;
    return { user: publicUser(user), token: this.sign(user) };
  }
}
