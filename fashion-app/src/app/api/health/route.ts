import { NextResponse } from 'next/server'
import { ensureBaseUsers, ensureUploadDirectories } from '@/lib/init'

let initialized = false

async function ensureInit() {
  if (initialized) return
  try {
    await ensureBaseUsers()
    ensureUploadDirectories()
    initialized = true
    console.log('✅ System initialized (admin + demo users + upload dirs)')
  } catch (e) {
    console.error('[Init Error]', e)
  }
}

export async function GET() {
  await ensureInit()
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
