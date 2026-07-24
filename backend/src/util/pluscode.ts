/**
 * Minimal Open Location Code (plus code) implementation.
 * Supports full-length (>= 8 pair digits) encode and decode.
 * Implements the public algorithm from https://github.com/google/open-location-code
 */

const CODE_ALPHABET = '23456789CFGHJMPQRVWX';
const SEPARATOR = '+';
const SEPARATOR_POSITION = 8;
const PADDING_CHARACTER = '0';
const PAIR_CODE_LENGTH = 10;
const PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];

function clipLatitude(lat: number): number {
  return Math.min(90, Math.max(-90, lat));
}

function normalizeLongitude(lon: number): number {
  let l = lon % 360;
  if (l < -180) l += 360;
  if (l >= 180) l -= 360;
  return l;
}

function computeLatitudePrecision(codeLength: number): number {
  if (codeLength <= PAIR_CODE_LENGTH) {
    return Math.pow(20, Math.floor(codeLength / -2 + 2));
  }
  return Math.pow(20, -3) / Math.pow(5, codeLength - PAIR_CODE_LENGTH);
}

export function encode(latitude: number, longitude: number, codeLength = 10): string {
  if (codeLength < 2 || (codeLength < SEPARATOR_POSITION && codeLength % 2 === 1)) {
    throw new Error('Invalid plus code length');
  }
  let lat = clipLatitude(latitude);
  const lon = normalizeLongitude(longitude);
  // Latitude 90 needs to be adjusted to be just less than 90.
  if (lat === 90) lat = lat - computeLatitudePrecision(codeLength);
  let code = '';
  let latVal = lat + 90;
  let lonVal = lon + 180;
  // Pair section.
  const pairLen = Math.min(codeLength, PAIR_CODE_LENGTH);
  for (let i = 0; i < pairLen / 2; i++) {
    const res = PAIR_RESOLUTIONS[i];
    const latDigit = Math.floor(latVal / res);
    const lonDigit = Math.floor(lonVal / res);
    latVal -= latDigit * res;
    lonVal -= lonDigit * res;
    code += CODE_ALPHABET[latDigit] + CODE_ALPHABET[lonDigit];
    if (code.length === SEPARATOR_POSITION) code += SEPARATOR;
  }
  // Pad if needed.
  if (code.length < SEPARATOR_POSITION) {
    code = code.padEnd(SEPARATOR_POSITION, PADDING_CHARACTER) + SEPARATOR;
  }
  // Grid section (codeLength > 10).
  if (codeLength > PAIR_CODE_LENGTH) {
    let latPlace = PAIR_RESOLUTIONS[PAIR_RESOLUTIONS.length - 1];
    let lonPlace = PAIR_RESOLUTIONS[PAIR_RESOLUTIONS.length - 1];
    for (let i = 0; i < codeLength - PAIR_CODE_LENGTH; i++) {
      latPlace /= 5;
      lonPlace /= 4;
      const row = Math.floor(latVal / latPlace);
      const col = Math.floor(lonVal / lonPlace);
      latVal -= row * latPlace;
      lonVal -= col * lonPlace;
      code += CODE_ALPHABET[row * 4 + col];
    }
  }
  return code;
}

export function isValid(code: string): boolean {
  if (!code || (code.match(new RegExp('\\' + SEPARATOR, 'g')) || []).length !== 1) return false;
  const idx = code.indexOf(SEPARATOR);
  if (idx === -1 || idx > SEPARATOR_POSITION || idx % 2 === 1) return false;
  for (const ch of code.replace(SEPARATOR, '')) {
    if (ch !== PADDING_CHARACTER && !CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function decode(code: string): { lat: number; lon: number; latHi: number; lonHi: number } {
  if (!isValid(code)) throw new Error('Invalid plus code');
  const clean = code.replace(SEPARATOR, '').replace(/0+$/, '');
  let latLo = -90;
  let lonLo = -180;
  const pairLen = Math.min(clean.length, PAIR_CODE_LENGTH);
  for (let i = 0; i < pairLen / 2; i++) {
    const res = PAIR_RESOLUTIONS[i];
    latLo += CODE_ALPHABET.indexOf(clean[i * 2]) * res;
    lonLo += CODE_ALPHABET.indexOf(clean[i * 2 + 1]) * res;
  }
  let latHi = latLo + PAIR_RESOLUTIONS[pairLen / 2 - 1];
  let lonHi = lonLo + PAIR_RESOLUTIONS[pairLen / 2 - 1];
  if (clean.length > PAIR_CODE_LENGTH) {
    let latPlace = PAIR_RESOLUTIONS[PAIR_RESOLUTIONS.length - 1];
    let lonPlace = PAIR_RESOLUTIONS[PAIR_RESOLUTIONS.length - 1];
    for (let i = PAIR_CODE_LENGTH; i < clean.length; i++) {
      latPlace /= 5;
      lonPlace /= 4;
      const v = CODE_ALPHABET.indexOf(clean[i]);
      const row = Math.floor(v / 4);
      const col = v % 4;
      latLo += row * latPlace;
      lonLo += col * lonPlace;
    }
    latHi = latLo + latPlace;
    lonHi = lonLo + lonPlace;
  }
  return { lat: (latLo + latHi) / 2, lon: (lonLo + lonHi) / 2, latHi, lonHi };
}
