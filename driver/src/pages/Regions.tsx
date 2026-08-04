import { useEffect, useRef, useState } from 'react';
import { api, asList, unwrap } from '../api';
import type { Region } from '../types';
import { osmTileUrl, tilesForBounds } from '../offline/tiles';
import { allRegionMeta, deleteRegion, getTile, putRegionMeta, putTile, tileKey } from '../offline/tileCache';

// Zoom range to cache per region. z10–16 ≈ full street/building detail (~78 MB for Chandigarh).
const ZOOM_MIN = 10;
const ZOOM_MAX = 16;
const CONCURRENCY = 6; // parallel tile fetches — kept modest to be polite to the tile server
const DEFAULT_BOUNDS = [30.6, 76.6, 30.9, 76.9]; // [minLat, minLon, maxLat, maxLon]

interface LocalState {
  downloading: boolean;
  downloaded: boolean;
  done: number;
  total: number;
  bytes: number;
}

export default function Regions() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [local, setLocal] = useState<Record<string, LocalState>>({});
  const cancelRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    api
      .get('/regions')
      .then((res) => setRegions(asList<Region>(unwrap(res))))
      .catch(() =>
        // Offline/demo fallback
        setRegions([
          { id: 'IN-CHD', name: 'Chandigarh', version: 4, size_mb: 78, bounds: DEFAULT_BOUNDS },
          { id: 'IN-DEL', name: 'Delhi', version: 1, size_mb: 205, bounds: [28.4, 76.83, 28.89, 77.35] },
        ]),
      );
  }, []);

  // Restore "downloaded" state from IndexedDB so it survives reloads.
  useEffect(() => {
    allRegionMeta()
      .then((metas) =>
        setLocal((s) => {
          const next = { ...s };
          for (const m of metas) {
            next[m.regionId] = {
              downloading: false,
              downloaded: true,
              done: m.tileKeys.length,
              total: m.tileKeys.length,
              bytes: m.bytes,
            };
          }
          return next;
        }),
      )
      .catch(() => {});
  }, []);

  const startDownload = async (r: Region) => {
    if (local[r.id]?.downloading) return;
    cancelRef.current[r.id] = false;

    const tiles = tilesForBounds(r.bounds ?? DEFAULT_BOUNDS, ZOOM_MIN, ZOOM_MAX);
    const total = tiles.length;
    setLocal((s) => ({ ...s, [r.id]: { downloading: true, downloaded: false, done: 0, total, bytes: 0 } }));

    let done = 0;
    let bytes = 0;
    let idx = 0;
    const keys: string[] = [];
    const bump = () =>
      setLocal((s) => ({ ...s, [r.id]: { downloading: true, downloaded: false, done, total, bytes } }));

    const worker = async () => {
      while (idx < tiles.length) {
        if (cancelRef.current[r.id]) return;
        const t = tiles[idx++];
        const k = tileKey(t.z, t.x, t.y);
        try {
          let data = await getTile(t.z, t.x, t.y);
          if (!data) {
            const res = await fetch(osmTileUrl(t.z, t.x, t.y));
            if (res.ok) {
              data = await res.arrayBuffer();
              await putTile(k, data);
            }
          }
          if (data) {
            bytes += data.byteLength;
            keys.push(k);
          }
        } catch {
          /* skip this tile — a few misses won't break the map */
        }
        done++;
        if (done % 10 === 0 || done === total) bump();
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    if (cancelRef.current[r.id]) {
      setLocal((s) => {
        const n = { ...s };
        delete n[r.id];
        return n;
      });
      return;
    }

    await putRegionMeta({ regionId: r.id, tileKeys: keys, bytes, zoomMin: ZOOM_MIN, zoomMax: ZOOM_MAX, savedAt: Date.now() });
    setLocal((s) => ({ ...s, [r.id]: { downloading: false, downloaded: true, done, total, bytes } }));
  };

  const cancel = (r: Region) => {
    cancelRef.current[r.id] = true;
  };

  const remove = async (r: Region) => {
    await deleteRegion(r.id);
    setLocal((s) => {
      const n = { ...s };
      delete n[r.id];
      return n;
    });
  };

  const fmtMb = (bytes: number) => (bytes / 1048576).toFixed(1);
  const regionSizeMb = (r: Region) =>
    r.size_mb ?? (typeof r.size_bytes === 'number' ? Math.round(r.size_bytes / 1048576) : undefined);

  return (
    <div className="p-4">
      <h1 className="mb-1 text-xl font-bold text-slate-800">Offline Regions</h1>
      <p className="mb-4 text-sm text-slate-500">
        Download map regions for offline navigation. Once downloaded, the map works with no internet.
      </p>

      <div className="space-y-3">
        {regions.map((r) => {
          const st = local[r.id];
          const pct = st && st.total > 0 ? Math.round((st.done / st.total) * 100) : 0;
          const sizeMb = regionSizeMb(r);
          return (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{r.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {r.id}
                    {r.version != null && ` · v${r.version}`}
                    {sizeMb != null && ` · ~${sizeMb} MB`}
                  </p>
                </div>
                {st?.downloaded && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    ✓ offline-ready{st.bytes > 0 ? ` · ${fmtMb(st.bytes)} MB` : ''}
                  </span>
                )}
              </div>

              {st?.downloading && (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Downloading… {pct}% · {st.done}/{st.total} tiles · {fmtMb(st.bytes)} MB
                  </p>
                </div>
              )}

              <div className="mt-3">
                {st?.downloading ? (
                  <button
                    onClick={() => cancel(r)}
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-600"
                  >
                    Cancel
                  </button>
                ) : st?.downloaded ? (
                  <button
                    onClick={() => remove(r)}
                    className="min-h-[44px] w-full rounded-lg border border-red-300 bg-white text-sm font-medium text-red-600"
                  >
                    Remove download
                  </button>
                ) : (
                  <button
                    onClick={() => startDownload(r)}
                    className="min-h-[44px] w-full rounded-lg bg-indigo-700 text-sm font-semibold text-white"
                  >
                    Download region
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
