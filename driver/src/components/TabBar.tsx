import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { api, asList, unwrap } from '../api';
import type { Notification } from '../types';
import { NOTIFS_LAST_SEEN_KEY } from '../pages/Notifications';

const tabs = [
  { to: '/', label: 'Queue', icon: '\u{1F4E6}' },
  { to: '/map', label: 'Map', icon: '\u{1F5FA}\u{FE0F}' },
  { to: '/notifications', label: 'Alerts', icon: '\u{1F514}' },
  { to: '/regions', label: 'Regions', icon: '\u{2B07}\u{FE0F}' },
  { to: '/profile', label: 'Profile', icon: '\u{1F464}' },
];

export default function TabBar() {
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  // Poll the unread count for the Alerts badge; also re-check on navigation
  // (so it clears right after the driver visits the Notifications screen).
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await api.get('/notifications');
        const list = asList<Notification>(unwrap(res));
        const lastSeen = Number(localStorage.getItem(NOTIFS_LAST_SEEN_KEY) || 0);
        if (active) setUnread(list.filter((n) => n.id > lastSeen).length);
      } catch {
        /* ignore — badge is best-effort */
      }
    };
    check();
    const t = setInterval(check, 60000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [location.pathname]);

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-slate-300 bg-white">
      <div className="grid grid-cols-5">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `relative flex min-h-[56px] flex-col items-center justify-center py-2 text-xs ${
                isActive ? 'font-semibold text-indigo-700' : 'text-slate-500'
              }`
            }
          >
            <span className="relative text-lg leading-none">
              {t.icon}
              {t.to === '/notifications' && unread > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
