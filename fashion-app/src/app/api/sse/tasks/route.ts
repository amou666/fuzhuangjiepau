import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifySseToken } from '@/lib/sse-tokens'

export const dynamic = 'force-dynamic'

// 跟踪每个 SSE 连接已推送过的任务状态，避免重复推送
const sentStates = new Map<string, Map<string, string>>() // connId -> taskId -> lastStatus

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

      // 轮询检查用户任务状态
      const interval = setInterval(() => {
        try {
          const connMap = sentStates.get(connId)
          if (!connMap) return

          // 查找用户所有任务（包括已完成的，因为可能是新完成的）
          const tasks = db.prepare(`
            SELECT id, status, resultUrl, upscaledUrl, errorMsg FROM GenerationTask
            WHERE userId = ?
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
      }, 3000)

      // 5分钟后自动关闭
      setTimeout(() => {
        clearInterval(interval)
        sentStates.delete(connId)
        try { controller.close() } catch {}
      }, 5 * 60 * 1000)

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
