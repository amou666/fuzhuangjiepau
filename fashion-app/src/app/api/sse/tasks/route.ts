import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifySseToken } from '@/lib/sse-tokens'

export const dynamic = 'force-dynamic'

// 跟踪每个 SSE 连接已推送过的任务状态，避免重复推送
const sentStates = new Map<string, Map<string, string>>() // connId -> taskId -> lastStatus

// SSE 连接超时（30 分钟，避免频繁重连导致通知堆积）
const SSE_TIMEOUT_MS = 30 * 60 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return new Response('Missing token', { status: 401 })
  }

  const userId = verifySseToken(token)
  if (!userId) {
    return new Response('Invalid token', { status: 401 })
  }

  // 每个连接有唯一的 ID 用于跟踪推送状态
  const connId = `${userId}-${Date.now()}`
  sentStates.set(connId, new Map())

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // 发送初始连接确认
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))

      // 首次连接时，把最近已完成的任务 ID 全部记入 sentStates，
      // 这样 SSE 重连后不会对已完成的旧任务重新推送 DONE 通知
      const recentCompleted = db.prepare(`
        SELECT id, status FROM GenerationTask
        WHERE userId = ? AND status IN ('COMPLETED', 'FAILED')
        ORDER BY updatedAt DESC
        LIMIT 20
      `).all(userId) as Array<{ id: string; status: string }>

      const connMap = sentStates.get(connId)!
      for (const task of recentCompleted) {
        // 标记为已发送，防止重连时重复推送
        const key = task.status === 'COMPLETED' ? 'DONE:' : 'FAILED:'
        connMap.set(task.id, key)
      }

      // 轮询检查用户任务状态
      const interval = setInterval(() => {
        try {
          const connMap = sentStates.get(connId)
          if (!connMap) return

          // 只查找最近 2 分钟内有更新的任务，避免对旧任务重复推送
          const tasks = db.prepare(`
            SELECT id, status, resultUrl, upscaledUrl, errorMsg FROM GenerationTask
            WHERE userId = ? AND updatedAt >= datetime('now', '-2 minutes')
            ORDER BY updatedAt DESC
            LIMIT 20
          `).all(userId) as Array<{ id: string; status: string; resultUrl: string | null; upscaledUrl: string | null; errorMsg: string | null }>

          for (const task of tasks) {
            const lastStatus = connMap.get(task.id)

            // 将 DB 状态映射为 SSE 状态
            let sseStatus: 'PROCESSING' | 'DONE' | 'FAILED'
            let resultUrl: string | undefined
            let errorMsg: string | undefined

            if (task.status === 'COMPLETED') {
              sseStatus = 'DONE'
              resultUrl = task.resultUrl || task.upscaledUrl || undefined
            } else if (task.status === 'FAILED') {
              sseStatus = 'FAILED'
              errorMsg = task.errorMsg || undefined
            } else {
              sseStatus = 'PROCESSING'
            }

            const sseStateKey = `${sseStatus}:${resultUrl || ''}:${errorMsg || ''}`

            // 只在状态变化时推送，避免重复
            if (lastStatus !== sseStateKey) {
              connMap.set(task.id, sseStateKey)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                taskId: task.id,
                status: sseStatus,
                resultUrl,
                errorMsg,
              })}\n\n`))
            }
          }

          // 心跳
          controller.enqueue(encoder.encode(`:heartbeat\n\n`))
        } catch (err) {
          console.error('[SSE Stream Error]', err)
        }
      }, 2000)

      // 30 分钟后自动关闭
      setTimeout(() => {
        clearInterval(interval)
        sentStates.delete(connId)
        try { controller.close() } catch {}
      }, SSE_TIMEOUT_MS)

      // 清理
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        sentStates.delete(connId)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
