import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

const menuItems = [
  { to: '/admin/dashboard', label: '数据看板', icon: '📊' },
  { to: '/admin/customers', label: '客户管理', icon: '👥' },
  { to: '/admin/credits', label: '积分管理', icon: '💎' },
  { to: '/admin/records', label: '生图记录', icon: '📸' },
  { to: '/admin/keywords-stats', label: '关键词分析', icon: '🏷️' },
  { to: '/admin/revenue', label: '营收报表', icon: '💰' },
  { to: '/admin/audit-logs', label: '审计日志', icon: '🛡️' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">✨</span>
            <span className="logo-text">Fashion AI</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">导航菜单</div>
            {menuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              <span>{user?.email?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="user-details">
              <div className="user-email">{user?.email}</div>
              <div className="user-role">管理员</div>
            </div>
          </div>
          <button
            className="logout-button"
            onClick={() => {
              clearSession();
              navigate('/login');
            }}
          >
            退出登录
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="main-shell">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
