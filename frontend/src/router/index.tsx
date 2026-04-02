import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { AppLayout } from '../components/layout/AppLayout';
import LoginPage from '../pages/auth/Login';
import RegisterPage from '../pages/auth/Register';
import DashboardPage from '../pages/admin/Dashboard';
import CustomersPage from '../pages/admin/Customers';
import CreditsPage from '../pages/admin/Credits';
import AdminRecordsPage from '../pages/admin/Records';
import AuditLogsPage from '../pages/admin/AuditLogs';
import KeywordsStatsPage from '../pages/admin/KeywordsStats';
import RevenuePage from '../pages/admin/Revenue';
import HistoryPage from '../pages/app/History';
import ProfilePage from '../pages/app/Profile';
import WorkspacePage from '../pages/app/Workspace';
import StatsPage from '../pages/app/Stats';
import { useAuthStore } from '../stores/authStore';
import type { Role } from '../types';

function RequireAuth() {
  const user = useAuthStore((state) => state.user);
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireRole({ role }: { role: Role }) {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/app/workspace'} replace />;
  }

  return <Outlet />;
}

function HomeRedirect() {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/app/workspace'} replace />;
}

export function AppRouter() {
  return (
    <div className="app-shell">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<RequireRole role="ADMIN" />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="credits" element={<CreditsPage />} />
                <Route path="records" element={<AdminRecordsPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
                <Route path="keywords-stats" element={<KeywordsStatsPage />} />
                <Route path="revenue" element={<RevenuePage />} />
              </Route>
            </Route>

            <Route element={<RequireRole role="CUSTOMER" />}>
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Navigate to="workspace" replace />} />
                <Route path="workspace" element={<WorkspacePage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="stats" element={<StatsPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
