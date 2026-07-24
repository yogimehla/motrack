import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { TOKEN_KEY } from './api';
import { OSM_ATTRIBUTION } from './mapStyle';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/deliveries', label: 'Deliveries', end: false },
  { to: '/deliveries/new', label: 'New Delivery', end: false },
  { to: '/drivers', label: 'Drivers', end: false },
  { to: '/regions', label: 'Regions', end: false },
  { to: '/feedback', label: 'Feedback', end: false },
];

export default function Layout() {
  const navigate = useNavigate();
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-slate-800 text-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-700">
          <h1 className="text-lg font-semibold text-white tracking-tight">MuulRoute</h1>
          <p className="text-xs text-slate-400 mt-0.5">Admin Console</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-600/90 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-slate-700">
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-8 py-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
        <footer className="px-8 py-4 text-xs text-slate-400 border-t border-slate-200 bg-white">
          MuulRoute Admin v1.1 · Map data {OSM_ATTRIBUTION}
        </footer>
      </div>
    </div>
  );
}
