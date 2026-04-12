'use client'

import { useCallback, useRef } from 'react'

interface UseSwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 }: UseSwipeOptions) {
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const touchEndX = useRef(0)
  const swiping = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchEndX.current = e.touches[0].clientX
    swiping.current = false
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
    const dx = Math.abs(touchEndX.current - touchStartX.current)
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dx > 10 && dx > dy) {
      swiping.current = true
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!swiping.current) return
    const diff = touchStartX.current - touchEndX.current
    if (Math.abs(diff) < threshold) return
    if (diff > 0) {
      onSwipeLeft?.()
    } else {
      onSwipeRight?.()
    }
    swiping.current = false
  }, [onSwipeLeft, onSwipeRight, threshold])

  return { onTouchStart, onTouchMove, onTouchEnd }
}
