import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage, unwrap } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('rajesh@muulroute.com');
  const [password, setPassword] = useState('driver123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      const data = unwrap<{ token?: string; access_token?: string }>(res);
      const token = data.token || data.access_token;
      if (!token) throw new Error('No token in response');
      localStorage.setItem('token', token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-100 px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-indigo-800">MuulRoute</h1>
        <p className="mb-6 mt-1 text-sm text-slate-500">Driver app — sign in to your queue</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-[48px] w-full rounded-lg border border-slate-300 px-3 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-[48px] w-full rounded-lg border border-slate-300 px-3 focus:border-indigo-400 focus:outline-none"
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="min-h-[48px] w-full rounded-lg bg-indigo-700 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
