import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { GlobalNotifications } from '../GlobalNotifications';
import { useAuthStore } from '../../stores/authStore';
import { useTaskSse } from '../../hooks/useTaskSse';

const menuItems = [
  { to: '/app/workspace', label: '工作台', icon: '✨' },
  { to: '/app/history', label: '历史记录', icon: '📷' },
  { to: '/app/stats', label: '消费统计', icon: '📊' },
  { to: '/app/profile', label: '账户设置', icon: '⚙️' },
];

export function AppLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const credits = useAuthStore((state) => state.user?.credits ?? 0);
  const clearSession = useAuthStore((state) => state.clearSession);

  // 在布局层挂载 SSE 连接，全局监听任务状态推送
  useTaskSse();

  return (
    <div className="app-layout">
      {/* 全局 Toast 通知 */}
      <GlobalNotifications />

      <aside className="app-sidebar">
        <div className="app-sidebar-header">
          <div className="app-logo">
            <div className="app-logo-icon">✨</div>
            <div className="app-logo-text">Fashion AI</div>
          </div>
        </div>

        <div className="app-sidebar-content">
          <nav className="app-nav">
            <div className="app-nav-section">
              <span className="app-nav-title">菜单</span>
              {menuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `app-nav-item ${isActive ? 'app-nav-item-active' : ''}`}
                >
                  <span className="app-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        </div>

        <div className="app-sidebar-footer">
          <div className="app-credits-card">
            <div className="app-credits-label">剩余积分</div>
            <div className="app-credits-value">{credits}</div>
          </div>
          <div className="app-user-info">
            <div className="app-user-avatar">{user?.email?.charAt(0).toUpperCase()}</div>
            <div className="app-user-details">
              <div className="app-user-email">{user?.email}</div>
              <div className="app-user-role">免费用户</div>
            </div>
          </div>
          <button
            className="app-logout-btn"
            onClick={() => {
              clearSession();
              navigate('/login');
            }}
          >
            退出登录
          </button>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
