'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useHydrated } from '@/lib/hooks/useHydrated'

export default function HomePage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const hydrated = useHydrated()

  useEffect(() => {
    if (!hydrated) return
    if (user) {
      router.push(user.role === 'ADMIN' ? '/dashboard' : '/quick-workspace')
    } else {
      router.push('/login')
    }
  }, [user, hydrated, router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf7f4', color: '#9b8e82' }}>
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(198,123,92,0.2)', borderTopColor: '#c67b5c' }} />
        <span className="text-sm">加载中...</span>
      </div>
    </div>
  )
}
