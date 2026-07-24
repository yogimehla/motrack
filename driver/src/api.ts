import axios from 'axios';

// In a native Capacitor app the Vite dev-proxy is not available,
// so point directly to the backend server.
// Change VITE_API_URL in .env (or set it here) to your server's IP/domain.
const baseURL =
  import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/v1`
    : '/api/v1';

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

/** Unwrap {success:true,data} envelope. */
export function unwrap<T>(res: { data: unknown }): T {
  const body = res.data as { success?: boolean; data?: T };
  return (body && typeof body === 'object' && 'data' in body ? body.data : body) as T;
}

/** Normalize a list payload that may be an array or {items|deliveries|regions:[]}. */
export function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['deliveries', 'items', 'regions', 'list', 'data']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { error?: string; message?: string } | undefined;
    return body?.error || body?.message || err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
