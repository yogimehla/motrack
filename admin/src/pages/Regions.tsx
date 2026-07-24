import { useEffect, useState } from 'react';
import { api, type Region } from '../api';
import { useToast } from '../toast';

interface DownloadInfo {
  urls?: Record<string, string> | string[];
  [key: string]: unknown;
}

export default function Regions() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ region: Region; info: DownloadInfo } | null>(null);
  const toast = useToast();

  useEffect(() => {
    api
      .get('/regions')
      .then((res) => {
        const list: Region[] = Array.isArray(res.data.data) ? res.data.data : res.data.data?.regions ?? [];
        setRegions(list);
      })
      .catch((e) => setError(e.response?.data?.error || e.message));
  }, []);

  const showDownload = async (region: Region) => {
    try {
      const res = await api.get(`/regions/${region.id}/download`);
      setModal({ region, info: res.data.data });
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed to fetch download URLs', 'error');
    }
  };

  const deltaCheck = async (region: Region) => {
    try {
      const res = await api.get(`/regions/${region.id}/delta`, {
        params: { version: region.version },
      });
      const d = res.data.data ?? {};
      if (d.hasUpdate) {
        toast(`${region.name}: update available`, 'success');
      } else {
        toast(d.note || `${region.name}: delta updates — V3`, 'info');
      }
    } catch (e: any) {
      // Endpoint may not exist yet; delta is a V3 feature per SPEC.
      if (e.response?.status === 404) {
        toast('Delta updates — V3', 'info');
      } else {
        toast(e.response?.data?.error || 'Delta check failed', 'error');
      }
    }
  };

  const urlEntries = (info: DownloadInfo): { label: string; url: string }[] => {
    const u = info.urls ?? info;
    if (Array.isArray(u)) return u.map((url, i) => ({ label: `Part ${i + 1}`, url }));
    if (u && typeof u === 'object') {
      return Object.entries(u as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string')
        .map(([label, url]) => ({ label, url: url as string }));
    }
    return [];
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-800">Regions</h2>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {regions.map((r) => (
          <div key={r.id} className="card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">{r.name}</h3>
                <p className="text-xs text-slate-400">{r.id}</p>
              </div>
              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                {r.status || 'active'}
              </span>
            </div>
            <dl className="text-sm text-slate-600 space-y-1">
              <div className="flex justify-between">
                <dt className="text-slate-400">Version</dt>
                <dd>v{r.version}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Size</dt>
                <dd>{r.size_mb} MB</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400 shrink-0">Bounds</dt>
                <dd className="text-right text-xs">{r.bounds?.join(', ')}</dd>
              </div>
            </dl>
            <div className="flex gap-2 pt-1">
              <button className="btn-secondary flex-1" onClick={() => showDownload(r)}>
                Download URLs
              </button>
              <button className="btn-secondary flex-1" onClick={() => deltaCheck(r)}>
                Delta check
              </button>
            </div>
          </div>
        ))}
        {regions.length === 0 && !error && <p className="text-sm text-slate-400">No regions available.</p>}
      </div>

      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setModal(null)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">Download URLs — {modal.region.name}</h3>
            <p className="text-xs text-slate-400 mb-4">Signed CDN URLs (stub)</p>
            <ul className="space-y-2 max-h-64 overflow-auto">
              {urlEntries(modal.info).map((e, i) => (
                <li key={i} className="text-sm">
                  <span className="text-slate-500 font-medium">{e.label}: </span>
                  <a href={e.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline break-all">
                    {e.url}
                  </a>
                </li>
              ))}
              {urlEntries(modal.info).length === 0 && <li className="text-sm text-slate-400">No URLs returned.</li>}
            </ul>
            <div className="mt-5 text-right">
              <button className="btn-secondary" onClick={() => setModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
