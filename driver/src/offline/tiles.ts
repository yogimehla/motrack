// Offline raster-tile plumbing for MapLibre.
//
// The maps use `OFFLINE_TILE_SOURCE` (osmcache://{z}/{x}/{y}) instead of a raw
// OSM URL. The registered protocol serves cache-first:
//   1. cached tile in IndexedDB  → return it (works with no network)
//   2. online miss               → fetch from OSM, return (not stored; only
//                                   explicit region downloads are persisted)
//   3. offline miss              → return a blank tile so the map never errors
//
// Net effect: once a region is downloaded, its tiles render fully offline.

import maplibregl from 'maplibre-gl';
import { getTile } from './tileCache';

export const OFFLINE_PROTOCOL = 'osmcache';
export const OFFLINE_TILE_SOURCE = `${OFFLINE_PROTOCOL}://{z}/{x}/{y}`;

// Bulk-downloading from OSM violates their tile policy at scale — swap this for
// your own / commercial tile server before production use.
const TILE_URL_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export function osmTileUrl(z: number, x: number, y: number): string {
  return TILE_URL_TEMPLATE.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

// ── Slippy-map tile math ────────────────────────────────────────────────────
export function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
export function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

/** All {z,x,y} tiles covering `bounds` = [minLat, minLon, maxLat, maxLon] across zMin..zMax. */
export function tilesForBounds(bounds: number[], zMin: number, zMax: number): { z: number; x: number; y: number }[] {
  const [minLat, minLon, maxLat, maxLon] = bounds;
  const out: { z: number; x: number; y: number }[] = [];
  for (let z = zMin; z <= zMax; z++) {
    const xa = lonToTileX(minLon, z);
    const xb = lonToTileX(maxLon, z);
    const ya = latToTileY(maxLat, z);
    const yb = latToTileY(minLat, z);
    for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) {
      for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) {
        out.push({ z, x, y });
      }
    }
  }
  return out;
}

// 1×1 transparent PNG, returned for tiles that are neither cached nor reachable.
const BLANK_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);
// Fresh copy each call — MapLibre may transfer (detach) the returned buffer to a worker.
const blankTile = () => ({ data: new Uint8Array(BLANK_PNG).buffer });

let registered = false;

/** Register the osmcache:// protocol. Call once at startup, before any map is created. */
export function registerOfflineTileProtocol(): void {
  if (registered) return;
  registered = true;
  maplibregl.addProtocol(OFFLINE_PROTOCOL, async (params: { url: string }) => {
    const parts = params.url.replace(`${OFFLINE_PROTOCOL}://`, '').split('/');
    const z = Number(parts[0]);
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y)) return blankTile();

    const cached = await getTile(z, x, y);
    if (cached) return { data: cached };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) return blankTile();
    try {
      const res = await fetch(osmTileUrl(z, x, y));
      if (!res.ok) return blankTile();
      return { data: await res.arrayBuffer() };
    } catch {
      return blankTile();
    }
  });
}
