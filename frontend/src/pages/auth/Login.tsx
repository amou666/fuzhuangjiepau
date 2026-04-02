import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { getErrorMessage } from '../../utils/api';
import { isValidEmail, normalizeEmail } from '../../utils/validation';

export default function LoginPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState('admin@fashionai.local');
  const [password, setPassword] = useState('Admin123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/app/workspace'} replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail) || !password) {
      setError('请输入有效邮箱和密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authApi.login({ email: normalizedEmail, password });
      setSession(response);
      navigate(response.user.role === 'ADMIN' ? '/admin/dashboard' : '/app/workspace', { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError, '登录失败，请稍后再试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <section className="hero-panel">
          <div>
            <div className="code-chip">AI Fashion SaaS</div>
            <h1>让服装上新图像生成真正可运营。</h1>
            <p>一个前后端已打通、可直接本地运行的服装 AI 生图平台原型。</p>
          </div>
          <div className="hero-points">
            <div className="hero-point">管理员可管理客户、充值积分、查看生成记录。</div>
            <div className="hero-point">客户可上传服装图、配置模特和场景，并异步生成结果。</div>
            <div className="hero-point">当前已启用本地 Mock AI，便于完整联调与测试。</div>
          </div>
        </section>
        <section className="form-panel">
          <h2 className="section-title">登录系统</h2>
          <p className="section-subtitle">默认管理员：admin@fashionai.local / Admin123!</p>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">邮箱</label>
              <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="password">密码</label>
              <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            {error ? <div className="error-text">{error}</div> : null}
            <button className="btn" type="submit" disabled={loading}>
              {loading ? '登录中...' : '立即登录'}
            </button>
          </form>
          <div className="panel" style={{ marginTop: 20 }}>
            <div className="muted-label">体验账号</div>
            <div className="helper-text">客户端：demo@fashionai.local / Demo123!</div>
          </div>
          <p className="helper-text" style={{ marginTop: 20 }}>
            还没有客户账号？<Link to="/register">前往注册</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
