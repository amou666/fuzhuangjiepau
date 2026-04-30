'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/** 全局触发函数，供 router.push 前手动调用 */
let _startFn: (() => void) | null = null

/** 在 router.push 前调用，触发底部进度条 */
export function showBottomProgress() {
  _startFn?.()
}

/**
 * 底部路由加载进度条
 * 在 SPA 路由切换时在页面底部显示进度动画，避免 iOS PWA 顶部原生加载条出现黑线
 */
export function BottomProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const startProgress = () => {
    clearTimers()
    setVisible(true)
    setProgress(20)
    const t1 = setTimeout(() => setProgress(50), 200)
    const t2 = setTimeout(() => setProgress(75), 600)
    timersRef.current.push(t1, t2)
  }

  // 注册全局触发函数
  useEffect(() => {
    _startFn = startProgress
    return () => { _startFn = null }
  }, [])

  // 路由切换完成
  useEffect(() => {
    if (!visible) return
    clearTimers()
    setProgress(100)
    const t = setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 400)
    timersRef.current.push(t)
    return clearTimers
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // 监听 <a> 点击和 popstate 来触发进度条
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      if (anchor) {
        const href = anchor.getAttribute('href')
        if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
          startProgress()
        }
      }
    }

    const onPopState = () => startProgress()

    document.addEventListener('click', handleClick)
    window.addEventListener('popstate', onPopState)

    return () => {
      document.removeEventListener('click', handleClick)
      window.removeEventListener('popstate', onPopState)
      clearTimers()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 不可见时完全移除 DOM，避免 iOS PWA 合成层残留导致底部黑线
  if (!visible) return null

  return (
    <div
      className="fixed left-0 right-0 z-[9999] pointer-events-none"
      style={{
        bottom: 0,
        height: 'calc(3px + env(safe-area-inset-bottom))',
        background: '#faf7f4',
      }}
    >
      <div
        style={{
          height: '3px',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #c67b5c, #d4a882)',
          borderRadius: progress >= 100 ? '0' : '0 2px 2px 0',
          transition: 'width 0.4s ease',
          boxShadow: '0 0 8px rgba(198,123,92,0.4)',
        }}
      />
    </div>
  )
}
