import type { IMapStorage, SignedUrl } from './IMapStorage.js';

/**
 * STUB (V2): Cloudflare R2-backed map bundle storage. v1.1 returns
 * deterministic CDN placeholder URLs instead of real signed URLs.
 */
export class R2Storage implements IMapStorage {
  readonly name = 'r2-stub';

  getSignedUrl(regionId: string, version: number, artifact: string): SignedUrl {
    const exp = new Date(Date.now() + 3600_000);
    return {
      url: `https://cdn.muulroute.example/bundles/${encodeURIComponent(regionId)}/v${version}/${artifact}?sig=stub`,
      expires_at: exp.toISOString(),
    };
  }
}
