import { decode, encode, isValid } from '../../util/pluscode.js';
import type { GeocodeResult, IGeocoder } from './IGeocoder.js';

/**
 * ACTIVE: plus code (Open Location Code) encode/decode, fully offline.
 * - encodeToPlusCode(lat, lon) -> full code
 * - search(q): if q is a valid plus code, decodes it to a coordinate.
 */
export class PlusCodeGeocoder implements IGeocoder {
  readonly name = 'plus-code';

  encodeToPlusCode(lat: number, lon: number): string {
    return encode(lat, lon);
  }

  decodePlusCode(code: string): { lat: number; lon: number } {
    const r = decode(code.trim().toUpperCase());
    return { lat: r.lat, lon: r.lon };
  }

  isPlusCode(q: string): boolean {
    return isValid(q.trim().toUpperCase());
  }

  async search(q: string): Promise<GeocodeResult[]> {
    const code = q.trim().toUpperCase();
    if (!isValid(code)) return [];
    const r = decode(code);
    return [{ lat: r.lat, lon: r.lon, display_name: `Plus code ${code}`, plus_code: code }];
  }

  async reverse(lat: number, lon: number): Promise<GeocodeResult | null> {
    const code = encode(lat, lon);
    return { lat, lon, display_name: `Plus code ${code}`, plus_code: code };
  }
}
