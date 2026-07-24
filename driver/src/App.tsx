import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Queue from './pages/Queue';
import MapPage from './pages/MapPage';
import Regions from './pages/Regions';
import Profile from './pages/Profile';
import TabBar from './components/TabBar';

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const onLogin = location.pathname === '/login';

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-slate-100 shadow-xl">
      <div className="flex-1 pb-20">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Queue /></RequireAuth>} />
          <Route path="/map" element={<RequireAuth><MapPage /></RequireAuth>} />
          <Route path="/regions" element={<RequireAuth><Regions /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!onLogin && <TabBar />}
    </div>
  );
}
