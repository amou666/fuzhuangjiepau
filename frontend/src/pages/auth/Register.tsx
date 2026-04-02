import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { getErrorMessage } from '../../utils/api';
import { hasMinPasswordLength, isValidEmail, normalizeEmail } from '../../utils/validation';

export default function RegisterPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/app/workspace'} replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setError('请输入有效邮箱');
      return;
    }

    if (!hasMinPasswordLength(password)) {
      setError('密码长度至少为 6 位');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authApi.register({ email: normalizedEmail, password });
      setSession(response);
      navigate('/app/workspace', { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError, '注册失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <section className="hero-panel">
          <div>
            <div className="code-chip">Client Onboarding</div>
            <h1>为你的服装品牌快速开通 AI 生图工作台。</h1>
            <p>注册成功后即可进入客户端，但生成前仍需管理员充值积分。</p>
          </div>
          <div className="hero-points">
            <div className="hero-point">统一 JWT 登录体系</div>
            <div className="hero-point">上传服装图 + 模特配置 + 场景配置</div>
            <div className="hero-point">历史记录与积分消耗一目了然</div>
          </div>
        </section>
        <section className="form-panel">
          <h2 className="section-title">注册客户账号</h2>
          <p className="section-subtitle">建议使用真实业务邮箱，便于后台管理与充值。</p>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="register-email">邮箱</label>
              <input
                id="register-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="register-password">密码</label>
              <input
                id="register-password"
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? <div className="error-text">{error}</div> : null}
            <button className="btn" type="submit" disabled={loading}>
              {loading ? '注册中...' : '注册并进入工作台'}
            </button>
          </form>
          <p className="helper-text" style={{ marginTop: 20 }}>
            已有账号？<Link to="/login">返回登录</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
