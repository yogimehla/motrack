import type { UserRow } from '../../db.js';

export interface AuthResult {
  user: Omit<UserRow, 'password_hash'>;
  token: string;
}

export interface IAuthProvider {
  readonly name: string;
  register(input: { email: string; password: string; name: string; role?: string }): AuthResult;
  login(email: string, password: string): AuthResult;
  verify(token: string): Omit<UserRow, 'password_hash'>;
  refresh(token: string): AuthResult;
}
