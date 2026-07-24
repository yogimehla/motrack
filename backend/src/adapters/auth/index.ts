import { EmailPasswordProvider } from './EmailPasswordProvider.js';

export type { IAuthProvider, AuthResult } from './IAuthProvider.js';
export { EmailPasswordProvider } from './EmailPasswordProvider.js';
export { MuulOriginSsoProvider } from './MuulOriginSsoProvider.js';

/** Active auth provider for v1.1. */
export const authProvider = new EmailPasswordProvider();
