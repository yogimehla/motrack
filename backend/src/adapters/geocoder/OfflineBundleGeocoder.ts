import type { GeocodeResult, IGeocoder } from './IGeocoder.js';

/**
 * STUB (V2): per-region offline geocoding backed by a SQLite index shipped in
 * the downloaded map bundle.
 */
export class OfflineBundleGeocoder implements IGeocoder {
  readonly name = 'offline-bundle';
  async search(_q: string): Promise<GeocodeResult[]> {
    throw Object.assign(new Error('OfflineBundleGeocoder is a V2 stub (per-region SQLite index)'), {
      status: 501,
    });
  }
  async reverse(_lat: number, _lon: number): Promise<GeocodeResult | null> {
    throw Object.assign(new Error('OfflineBundleGeocoder is a V2 stub (per-region SQLite index)'), {
      status: 501,
    });
  }
}
