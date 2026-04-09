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
      router.push(user.role === 'ADMIN' ? '/dashboard' : '/workspace')
    } else {
      router.push('/login')
    }
  }, [user, hydrated, router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#fff' }}>
      <div>加载中...</div>
    </div>
  )
}
