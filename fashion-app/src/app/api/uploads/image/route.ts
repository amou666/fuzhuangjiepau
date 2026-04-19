import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthed } from '@/lib/api-auth'
import { config, getUploadPath } from '@/lib/config'
import { ensureUploadDirectories } from '@/lib/init'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

let dirsReady = false

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if (!isAuthed(auth)) return auth

    if (!dirsReady) {
      await ensureUploadDirectories()
      dirsReady = true
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: '请上传图片文件' }, { status: 400 })
    }

    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return NextResponse.json(
        { message: '仅支持 PNG / JPG / WEBP / GIF 格式' },
        { status: 400 },
      )
    }

    if (file.size > config.maxFileSize) {
      return NextResponse.json(
        { message: `文件大小不能超过 ${Math.round(config.maxFileSize / 1024 / 1024)}MB` },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = `${uuidv4()}${ext}`
    const uploadRoot = getUploadPath()
    const destPath = path.join(uploadRoot, filename)

    await fs.writeFile(destPath, buffer)

    const url = `/uploads/${filename}`
    return NextResponse.json({ url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ message: '上传失败' }, { status: 500 })
  }
}
