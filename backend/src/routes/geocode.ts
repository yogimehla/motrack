import { Hono } from 'hono';
import { geocoder, plusCodeGeocoder } from '../adapters/geocoder/index.js';
import { fail, ok } from '../http.js';

export const geocodeRoutes = new Hono();

geocodeRoutes.get('/search', async (c) => {
  const q = c.req.query('q');
  if (!q) return fail(c, 'Missing query param q');
  // Plus codes resolve locally and instantly.
  if (plusCodeGeocoder.isPlusCode(q)) {
    return ok(c, await plusCodeGeocoder.search(q));
  }
  return ok(c, await geocoder.search(q));
});

geocodeRoutes.get('/reverse', async (c) => {
  const lat = Number(c.req.query('lat'));
  const lon = Number(c.req.query('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return fail(c, 'lat and lon query params required');
  return ok(c, await geocoder.reverse(lat, lon));
});

geocodeRoutes.get('/pluscode', (c) => {
  const code = c.req.query('code');
  if (code) {
    if (!plusCodeGeocoder.isPlusCode(code)) return fail(c, 'Invalid plus code');
    const r = plusCodeGeocoder.decodePlusCode(code);
    return ok(c, { code: code.trim().toUpperCase(), lat: r.lat, lon: r.lon });
  }
  const lat = Number(c.req.query('lat'));
  const lon = Number(c.req.query('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return fail(c, 'Provide lat & lon (encode) or code (decode)');
  }
  return ok(c, { lat, lon, plus_code: plusCodeGeocoder.encodeToPlusCode(lat, lon) });
});
