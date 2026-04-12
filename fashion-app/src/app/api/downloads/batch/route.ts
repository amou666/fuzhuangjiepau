import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { getUploadPath } from '@/lib/config'
import { safeJsonParse } from '@/lib/utils/json'
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import { PassThrough } from 'stream'

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth
    const { payload } = auth

    const body = await request.json()
    const { taskIds } = body

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ message: '请提供至少一个任务 ID' }, { status: 400 })
    }

    if (taskIds.length > 50) {
      return NextResponse.json({ message: '单次最多打包 50 个任务' }, { status: 400 })
    }

    const placeholders = taskIds.map(() => '?').join(',')
    const tasks = db.prepare(
      `SELECT * FROM GenerationTask WHERE id IN (${placeholders}) AND userId = ?`
    ).all(...taskIds, payload.userId) as any[]

    if (tasks.length === 0) {
      return NextResponse.json({ message: '未找到可下载的任务' }, { status: 404 })
    }

    const uploadRoot = getUploadPath()

    const filesToZip: { name: string; source: string | 'url'; path: string }[] = []
    let fileIndex = 0

    for (const task of tasks) {
      const resultUrls: string[] = safeJsonParse(task.resultUrls, [])
      const allUrls: string[] = []

      if (resultUrls.length > 0) {
        allUrls.push(...resultUrls)
      } else if (task.resultUrl) {
        allUrls.push(task.resultUrl)
      }

      if (task.upscaledUrl) {
        allUrls.push(task.upscaledUrl)
      }

      for (const url of allUrls) {
        fileIndex++
        const isLocal = url.startsWith('/uploads/')
        if (isLocal) {
          const relative = url.replace(/^\/uploads\//, '')
          const filePath = path.join(uploadRoot, relative)
          if (fs.existsSync(filePath)) {
            const ext = path.extname(relative) || '.png'
            const isUpscaled = url === task.upscaledUrl
            const suffix = isUpscaled ? '_hd' : ''
            filesToZip.push({
              name: `${String(fileIndex).padStart(3, '0')}_${task.id.slice(0, 8)}${suffix}${ext}`,
              source: 'local',
              path: filePath,
            })
          }
        } else {
          try {
            const ext = path.extname(new URL(url).pathname) || '.png'
            const isUpscaled = url === task.upscaledUrl
            const suffix = isUpscaled ? '_hd' : ''
            filesToZip.push({
              name: `${String(fileIndex).padStart(3, '0')}_${task.id.slice(0, 8)}${suffix}${ext}`,
              source: 'url',
              path: url,
            })
          } catch {
            // skip malformed URLs
          }
        }
      }
    }

    if (filesToZip.length === 0) {
      return NextResponse.json({ message: '没有可下载的图片' }, { status: 404 })
    }

    const passthrough = new PassThrough()
    const archive = archiver('zip', { zlib: { level: 5 } })

    archive.pipe(passthrough)

    for (const file of filesToZip) {
      if (file.source === 'local') {
        archive.file(file.path, { name: file.name })
      } else {
        try {
          const resp = await fetch(file.path)
          if (resp.ok && resp.body) {
            const buf = Buffer.from(await resp.arrayBuffer())
            archive.append(buf, { name: file.name })
          }
        } catch {
          // skip remote files that fail to fetch
        }
      }
    }

    void archive.finalize()

    const reader = passthrough as unknown as ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        passthrough.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk))
        })
        passthrough.on('end', () => {
          controller.close()
        })
        passthrough.on('error', (err) => {
          controller.error(err)
        })
      },
    })

    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="fashion-ai-${timestamp}.zip"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: any) {
    console.error('Batch download error:', error)
    return NextResponse.json({ message: '打包下载失败' }, { status: 500 })
  }
}
