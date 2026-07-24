import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Queue', icon: '\u{1F4E6}' },
  { to: '/map', label: 'Map', icon: '\u{1F5FA}\u{FE0F}' },
  { to: '/regions', label: 'Regions', icon: '\u{2B07}\u{FE0F}' },
  { to: '/profile', label: 'Profile', icon: '\u{1F464}' },
];

export default function TabBar() {
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-slate-300 bg-white">
      <div className="grid grid-cols-4">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-col items-center justify-center py-2 text-xs ${
                isActive ? 'font-semibold text-indigo-700' : 'text-slate-500'
              }`
            }
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
