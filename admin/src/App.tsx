import { Navigate, Route, Routes } from 'react-router-dom';
import { TOKEN_KEY } from './api';
import Layout from './Layout';
import { ToastProvider } from './toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Deliveries from './pages/Deliveries';
import NewDelivery from './pages/NewDelivery';
import Drivers from './pages/Drivers';
import Regions from './pages/Regions';
import FeedbackPage from './pages/Feedback';
import type { ReactElement } from 'react';

function RequireAuth({ children }: { children: ReactElement }) {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/deliveries/new" element={<NewDelivery />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/regions" element={<Regions />} />
          <Route path="/feedback" element={<FeedbackPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
