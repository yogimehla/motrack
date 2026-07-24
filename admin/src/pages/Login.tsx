import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, TOKEN_KEY } from '../api';

export default function Login() {
  const [email, setEmail] = useState('admin@muulroute.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const data = res.data?.data ?? {};
      const token = data.token ?? data.access_token;
      if (!token) throw new Error('No token in response');
      localStorage.setItem(TOKEN_KEY, token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-slate-800">MuulRoute Admin</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">Sign in to your account</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
