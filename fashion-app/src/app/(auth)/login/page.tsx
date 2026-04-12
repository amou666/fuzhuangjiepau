'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { authApi } from '@/lib/api/auth'
import { useHydrated } from '@/lib/hooks/useHydrated'
import { useAuthStore } from '@/lib/stores/authStore'
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
      <div className="min-h-screen flex items-center justify-center bg-[#faf7f4] px-6">
        <div className="flex items-center gap-3 text-[#9b8e82]">
          <div
            className="h-5 w-5 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(198,123,92,0.2)', borderTopColor: '#c67b5c' }}
          />
          <span className="text-sm">加载中...</span>
        </div>
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
    <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-[#faf7f4]">
      <div className="w-full max-w-[420px] rounded-[32px] border border-[rgba(139,115,85,0.08)] bg-[rgba(255,252,249,0.9)] p-8 shadow-[0_20px_60px_rgba(139,115,85,0.12)] backdrop-blur-sm sm:p-10">
        <h1 className="m-0 text-[34px] font-bold tracking-tight text-[#2d2422]">登录系统</h1>
        <p className="mt-2 mb-8 text-[15px] leading-6 text-[#9b8e82]">请输入您的账号和密码</p>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-[14px] font-semibold text-[#6f5f55]">
              邮箱
            </label>
            <input
              id="email"
              className="h-14 w-full rounded-2xl border border-[rgba(139,115,85,0.12)] bg-[#f6efe8] px-4 text-[15px] text-[#2d2422] outline-none transition-all placeholder:text-[#c4b4a7] focus:border-[rgba(198,123,92,0.35)] focus:bg-[#fffaf6] focus:ring-4 focus:ring-[rgba(198,123,92,0.12)]"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="请输入邮箱"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-[14px] font-semibold text-[#6f5f55]">
              密码
            </label>
            <input
              id="password"
              className="h-14 w-full rounded-2xl border border-[rgba(139,115,85,0.12)] bg-[#f6efe8] px-4 text-[15px] text-[#2d2422] outline-none transition-all placeholder:text-[#c4b4a7] focus:border-[rgba(198,123,92,0.35)] focus:bg-[#fffaf6] focus:ring-4 focus:ring-[rgba(198,123,92,0.12)]"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-[rgba(196,112,112,0.16)] bg-[rgba(254,242,240,0.9)] px-4 py-3 text-sm font-medium text-[#c47070]">
              {error}
            </div>
          ) : null}

          <button
            className="mt-1 inline-flex h-14 items-center justify-center gap-2 rounded-full border-none bg-[linear-gradient(135deg,#c67b5c_0%,#d4a882_100%)] px-6 text-[16px] font-bold text-white transition-all shadow-[0_12px_28px_rgba(198,123,92,0.28)] hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(198,123,92,0.34)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                立即登录
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

