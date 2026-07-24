import { encode as plusEncode } from '../../util/pluscode.js';
import type { GeocodeResult, IGeocoder } from './IGeocoder.js';

const UA = 'MuulRoute/1.1 (demo; contact admin@muulroute.com)';

/**
 * ACTIVE geocoder: proxies https://nominatim.openstreetmap.org with a proper
 * User-Agent and a 5s timeout. Falls back gracefully (empty results / null)
 * when offline or on error instead of throwing.
 */
export class NominatimGeocoder implements IGeocoder {
  readonly name = 'nominatim';

  private async fetchJson(url: string): Promise<unknown> {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`nominatim HTTP ${res.status}`);
    return res.json();
  }

  async search(q: string): Promise<GeocodeResult[]> {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(q)}`;
      const data = (await this.fetchJson(url)) as { lat: string; lon: string; display_name: string }[];
      return data.map((r) => {
        const lat = Number(r.lat);
        const lon = Number(r.lon);
        return { lat, lon, display_name: r.display_name, plus_code: plusEncode(lat, lon) };
      });
    } catch (e) {
      console.warn('[geocoder] search fallback (offline/error):', (e as Error).message);
      return [];
    }
  }

  async reverse(lat: number, lon: number): Promise<GeocodeResult | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
      const r = (await this.fetchJson(url)) as { lat: string; lon: string; display_name?: string };
      return {
        lat: Number(r.lat ?? lat),
        lon: Number(r.lon ?? lon),
        display_name: r.display_name || `${lat},${lon}`,
        plus_code: plusEncode(lat, lon),
      };
    } catch (e) {
      console.warn('[geocoder] reverse fallback (offline/error):', (e as Error).message);
      // Graceful offline fallback: still return coordinates + plus code.
      return { lat, lon, display_name: `${lat},${lon} (offline)`, plus_code: plusEncode(lat, lon) };
    }
  }
}
