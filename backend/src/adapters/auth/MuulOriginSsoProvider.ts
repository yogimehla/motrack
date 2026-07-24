import type { AuthResult, IAuthProvider } from './IAuthProvider.js';

/**
 * STUB (V2): MoInvoice single-sign-on provider.
 * Will read the `mo_token` cookie set by MoInvoice Origin and exchange it for a
 * MuulRoute session. Not wired in v1.1 — every method throws.
 */
export class MuulOriginSsoProvider implements IAuthProvider {
  readonly name = 'muulorigin-sso';

  private notImplemented(): never {
    throw Object.assign(new Error('MuulOriginSsoProvider is a V2 stub (mo_token cookie SSO)'), {
      status: 501,
    });
  }

  register(): AuthResult {
    return this.notImplemented();
  }
  login(): AuthResult {
    return this.notImplemented();
  }
  verify(): never {
    return this.notImplemented();
  }
  refresh(): AuthResult {
    return this.notImplemented();
  }
}
