'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHydrated } from '@/lib/hooks/useHydrated'
import { getErrorMessage } from '@/lib/utils/api'
import { isValidEmail, normalizeEmail } from '@/lib/utils/validation'

export default function LoginPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const hydrated = useHydrated()
  const setSession = useAuthStore((state) => state.setSession)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (hydrated && user) {
      router.push(user.role === 'ADMIN' ? '/dashboard' : '/workspace')
    }
  }, [user, hydrated, router])

  if (!hydrated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#fff' }}>
        <div>加载中...</div>
      </div>
    )
  }

  if (user) {
    return null
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = normalizeEmail(email)

    if (!isValidEmail(normalizedEmail) || !password) {
      setError('请输入有效邮箱和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await authApi.login({ email: normalizedEmail, password })
      setSession(response)
      router.push(response.user.role === 'ADMIN' ? '/dashboard' : '/workspace')
    } catch (submitError) {
      setError(getErrorMessage(submitError, '登录失败，请稍后再试'))
    } finally {
      setLoading(false)
    }
  }

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
            <div className="hero-point">AI 生图引擎已就绪，一键生成高质量街拍图。</div>
          </div>
        </section>
        <section className="form-panel">
          <h2 className="section-title">登录系统</h2>
          <p className="section-subtitle">请输入您的账号和密码</p>
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

        </section>
      </div>
    </div>
  )
}
