import { NextRequest, NextResponse } from 'next/server'
import { getUploadPath } from '@/lib/config'
import fs from 'fs/promises'
import path from 'path'

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const segments = (await params).path
    if (!segments || segments.length === 0) {
      return NextResponse.json({ message: '路径无效' }, { status: 400 })
    }

    // 拒绝任何段为空 / 绝对路径 / 含反斜杠 / 包含 .. 段
    for (const seg of segments) {
      if (!seg || seg === '..' || seg.includes('\\') || seg.startsWith('/')) {
        return NextResponse.json({ message: '路径非法' }, { status: 400 })
      }
    }

    const root = path.resolve(getUploadPath())
    const resolved = path.resolve(root, ...segments)
    // 防路径穿越：最终绝对路径必须严格位于 upload 根目录下
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return NextResponse.json({ message: '路径非法' }, { status: 400 })
    }

    let stat
    try {
      stat = await fs.stat(resolved)
    } catch {
      return NextResponse.json({ message: '文件不存在' }, { status: 404 })
    }
    if (!stat.isFile()) {
      return NextResponse.json({ message: '文件不存在' }, { status: 404 })
    }

    const ext = path.extname(resolved).toLowerCase()
    const contentType = MIME_MAP[ext]
    if (!contentType) {
      // 只服务白名单扩展名，避免把任意文件（.js/.html 等）当静态资源吐出
      return NextResponse.json({ message: '不支持的文件类型' }, { status: 400 })
    }

    const data = await fs.readFile(resolved)
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Serve file error:', error)
    return NextResponse.json({ message: '文件读取失败' }, { status: 500 })
  }
}
