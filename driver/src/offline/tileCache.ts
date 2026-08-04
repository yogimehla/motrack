// IndexedDB-backed store for offline raster map tiles.
//
// Two object stores:
//   tiles   — keyPath 'k' ("z/x/y")  → { k, data: ArrayBuffer, bytes }
//   regions — keyPath 'regionId'     → RegionMeta (which tiles belong to a downloaded region)
//
// Tiles are shared by key, so deleting a region only removes tiles no other
// downloaded region still references.

const DB_NAME = 'muulroute-offline';
const DB_VERSION = 1;
const TILE_STORE = 'tiles';
const META_STORE = 'regions';

export interface RegionMeta {
  regionId: string;
  tileKeys: string[];
  bytes: number;
  zoomMin: number;
  zoomMax: number;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TILE_STORE)) db.createObjectStore(TILE_STORE, { keyPath: 'k' });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'regionId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function request<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(store, mode).objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const tileKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`;

export async function getTile(z: number, x: number, y: number): Promise<ArrayBuffer | undefined> {
  const row = await request<{ data: ArrayBuffer } | undefined>(TILE_STORE, 'readonly', (s) => s.get(tileKey(z, x, y)));
  return row?.data;
}

export async function putTile(k: string, data: ArrayBuffer): Promise<void> {
  await request(TILE_STORE, 'readwrite', (s) => s.put({ k, data, bytes: data.byteLength }));
}

export function getRegionMeta(regionId: string): Promise<RegionMeta | undefined> {
  return request<RegionMeta | undefined>(META_STORE, 'readonly', (s) => s.get(regionId));
}

export async function putRegionMeta(meta: RegionMeta): Promise<void> {
  await request(META_STORE, 'readwrite', (s) => s.put(meta));
}

export function allRegionMeta(): Promise<RegionMeta[]> {
  return request<RegionMeta[]>(META_STORE, 'readonly', (s) => s.getAll());
}

/** Delete a region's metadata and any of its tiles not referenced by another region. */
export async function deleteRegion(regionId: string): Promise<void> {
  const meta = await getRegionMeta(regionId);
  if (!meta) return;
  const others = (await allRegionMeta()).filter((m) => m.regionId !== regionId);
  const keep = new Set<string>();
  others.forEach((m) => m.tileKeys.forEach((k) => keep.add(k)));

  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([TILE_STORE, META_STORE], 'readwrite');
    const tiles = tx.objectStore(TILE_STORE);
    for (const k of meta.tileKeys) if (!keep.has(k)) tiles.delete(k);
    tx.objectStore(META_STORE).delete(regionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
