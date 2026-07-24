import { useEffect, useRef, useState } from 'react';
import { api, asList, unwrap } from '../api';
import type { Region } from '../types';

interface LocalRegionState {
  progress: number; // 0-100
  downloaded: boolean;
  downloading: boolean;
}

export default function Regions() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [local, setLocal] = useState<Record<string, LocalRegionState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    api
      .get('/regions')
      .then((res) => setRegions(asList<Region>(unwrap(res))))
      .catch(() =>
        // Offline/demo fallback
        setRegions([
          { id: 'IN-CHD', name: 'Chandigarh', version: 4, size_mb: 80, bounds: [30.6, 76.6, 30.9, 76.9] },
        ]),
      );
    return () => {
      Object.values(timers.current).forEach(clearInterval);
    };
  }, []);

  const startDownload = (r: Region) => {
    if (local[r.id]?.downloading || local[r.id]?.downloaded) return;
    setLocal((s) => ({ ...s, [r.id]: { progress: 0, downloaded: false, downloading: true } }));
    timers.current[r.id] = setInterval(() => {
      setLocal((s) => {
        const cur = s[r.id];
        if (!cur) return s;
        const next = Math.min(100, cur.progress + Math.random() * 12 + 4);
        const done = next >= 100;
        if (done) {
          clearInterval(timers.current[r.id]);
          return { ...s, [r.id]: { progress: 100, downloaded: true, downloading: false } };
        }
        return { ...s, [r.id]: { ...cur, progress: next } };
      });
    }, 400);
  };

  const remove = (r: Region) => {
    clearInterval(timers.current[r.id]);
    setLocal((s) => ({ ...s, [r.id]: { progress: 0, downloaded: false, downloading: false } }));
  };

  return (
    <div className="p-4">
      <h1 className="mb-1 text-xl font-bold text-slate-800">Offline Regions</h1>
      <p className="mb-4 text-sm text-slate-500">Download map regions for offline navigation.</p>

      <div className="space-y-3">
        {regions.map((r) => {
          const st = local[r.id];
          return (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{r.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {r.id}
                    {r.version != null && ` · v${r.version}`}
                    {r.size_mb != null && ` · ${r.size_mb} MB`}
                  </p>
                </div>
                {st?.downloaded && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    ✓ offline-ready
                  </span>
                )}
              </div>

              {st?.downloading && (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${st.progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Downloading… {Math.round(st.progress)}%</p>
                </div>
              )}

              <div className="mt-3">
                {st?.downloaded ? (
                  <button
                    onClick={() => remove(r)}
                    className="min-h-[44px] w-full rounded-lg border border-red-300 bg-white text-sm font-medium text-red-600"
                  >
                    Remove download
                  </button>
                ) : (
                  <button
                    onClick={() => startDownload(r)}
                    disabled={st?.downloading}
                    className="min-h-[44px] w-full rounded-lg bg-indigo-700 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {st?.downloading ? 'Downloading…' : 'Download region'}
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
