'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'

/**
 * 处理 zustand/persist 的 hydration 问题。
 * 等待 zustand persist middleware 从 localStorage 恢复数据完成后才返回 true。
 * 在 hydration 完成前，state 可能还是默认值，直接读取会导致错误判断（例如误判未登录）。
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // 如果已经 hydration 完成了
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }

    // 等待 hydration 完成
    const unsubHydrate = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true)
    })

    return () => {
      // zustand v5 的 onFinishHydration 返回 unsubscribe 函数
      if (typeof unsubHydrate === 'function') {
        unsubHydrate()
      }
    }
  }, [])

  return hydrated
}
