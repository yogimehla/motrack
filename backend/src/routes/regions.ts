import { Hono } from 'hono';
import { db } from '../db.js';
import { mapStorage } from '../adapters/storage/index.js';
import { haversineKm } from '../util/geo.js';
import { fail, ok } from '../http.js';

interface RegionRow {
  id: string;
  name: string;
  version: number;
  size_bytes: number;
  bounds: string;
  created_at: string;
}

function toPublic(r: RegionRow) {
  return { ...r, bounds: JSON.parse(r.bounds) as number[] };
}

export const regionsRoutes = new Hono();

regionsRoutes.get('/', (c) => {
  const rows = db.prepare('SELECT * FROM regions ORDER BY id').all() as RegionRow[];
  return ok(c, rows.map(toPublic));
});

regionsRoutes.get('/nearby', (c) => {
  const lat = Number(c.req.query('lat'));
  const lon = Number(c.req.query('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return fail(c, 'lat and lon query params required');
  const rows = db.prepare('SELECT * FROM regions').all() as RegionRow[];
  const withDist = rows.map((r) => {
    const [minLat, minLon, maxLat, maxLon] = JSON.parse(r.bounds) as number[];
    const cLat = (minLat + maxLat) / 2;
    const cLon = (minLon + maxLon) / 2;
    const inside = lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
    return { ...toPublic(r), inside, distance_km: Math.round(haversineKm(lat, lon, cLat, cLon) * 100) / 100 };
  });
  withDist.sort((a, b) => a.distance_km - b.distance_km);
  return ok(c, withDist);
});

regionsRoutes.get('/:id', (c) => {
  const row = db.prepare('SELECT * FROM regions WHERE id = ?').get(c.req.param('id')) as
    | RegionRow
    | undefined;
  if (!row) return fail(c, 'Region not found', 404);
  return ok(c, toPublic(row));
});

regionsRoutes.get('/:id/download', (c) => {
  const row = db.prepare('SELECT * FROM regions WHERE id = ?').get(c.req.param('id')) as
    | RegionRow
    | undefined;
  if (!row) return fail(c, 'Region not found', 404);
  const artifacts = ['tiles.mbtiles', 'geocoder.sqlite', 'routing.graph'];
  return ok(c, {
    region: row.id,
    version: row.version,
    size_bytes: row.size_bytes,
    note: 'Signed-url stub (V2 R2 storage) — placeholder CDN URLs',
    files: artifacts.map((a) => ({ artifact: a, ...mapStorage.getSignedUrl(row.id, row.version, a) })),
  });
});

// Delta update check — V3 feature.
regionsRoutes.get('/:id/delta', (c) => {
  const row = db.prepare('SELECT id FROM regions WHERE id = ?').get(c.req.param('id'));
  if (!row) return fail(c, 'Region not found', 404);
  return ok(c, { hasUpdate: false, note: 'V3' });
});
