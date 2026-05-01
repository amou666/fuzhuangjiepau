'use client'

let container: HTMLDivElement | null = null
let timer: ReturnType<typeof setTimeout> | null = null

/**
 * 在页面底部显示一个细进度条，2 秒后自动消失。
 * 用于「发送到工作台」等跳转场景，给用户视觉反馈。
 */
export function showBottomProgress(duration = 2000) {
  // 清除上一次
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (container) {
    container.remove()
    container = null
  }

  container = document.createElement('div')
  container.id = 'bottom-progress-bar'
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '0',
    left: '0',
    width: '100%',
    height: '3px',
    zIndex: '99999',
    pointerEvents: 'none',
  })

  const bar = document.createElement('div')
  Object.assign(bar.style, {
    height: '100%',
    width: '0%',
    background: 'linear-gradient(90deg, #c67b5c, #d4a882)',
    borderRadius: '0 2px 2px 0',
    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
  })

  container.appendChild(bar)
  document.body.appendChild(container)

  // 触发动画
  requestAnimationFrame(() => {
    bar.style.width = '70%'
  })

  timer = setTimeout(() => {
    bar.style.width = '100%'
    setTimeout(() => {
      if (container) {
        container.style.opacity = '0'
        container.style.transition = 'opacity 0.3s ease'
        setTimeout(() => {
          container?.remove()
          container = null
        }, 300)
      }
    }, 400)
  }, duration * 0.6)
}
