'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'

/**
 * 处理 zustand/persist 的 hydration 问题。
 * 在客户端首次渲染时，zustand/persist 从 localStorage 恢复数据，
 * 但初始渲染时 state 还是默认值，会导致 SSR/Client 不匹配。
 * 此 hook 返回 true 表示 hydration 完成，可以安全读取 state。
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated
}
