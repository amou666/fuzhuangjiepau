import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAuthed } from '@/lib/api-auth'
import { config } from '@/lib/config'
import { db } from '@/lib/db'
import { decryptApiKey } from '@/lib/utils/security'
import { getActiveAnalysisModel } from '@/lib/system-config'

/** POST /api/admin/pose-presets/generate-prompt — 根据中文名+分类自动生成英文 fashion pose prompt */
export async function POST(request: NextRequest) {
  try {
    const auth = requireAdmin(request)
    if (!isAuthed(auth)) return auth

    const { label, category } = await request.json()
    if (!label?.trim()) {
      return NextResponse.json({ message: '姿势名称不能为空' }, { status: 400 })
    }

    // 优先使用管理员自身的 API Key，否则回退到系统配置
    const adminUser = db.prepare('SELECT apiKey FROM User WHERE id = ?').get(auth.payload.userId) as { apiKey: string | null } | undefined
    const apiKey = (adminUser?.apiKey ? decryptApiKey(adminUser.apiKey) : '') || config.aiApiKey
    if (!apiKey) {
      return NextResponse.json({ message: '未配置 AI API Key，请在个人设置中添加' }, { status: 500 })
    }

    const categoryMap: Record<string, string> = {
      daily: '日常/casual daily',
      beach: '海边/beach',
      street: '街拍/street photography',
      studio: '棚拍/studio',
    }
    const categoryHint = categoryMap[category] || category || '通用/general'
    const model = getActiveAnalysisModel()

    console.log(`[Generate Pose Prompt] label="${label.trim()}", category=${category}, model=${model}`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    try {
      const response = await fetch(`${config.aiApiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: 'system',
              content: `You are an expert fashion photography pose consultant. Your task is to convert a Chinese pose name into a professional English fashion pose prompt that can be used for AI image generation.

Rules:
- Output ONLY the English prompt text, no explanation, no markdown, no quotes.
- The prompt should describe the model's body pose, limb positions, posture, and attitude in detail.
- Use professional fashion photography terminology.
- Keep the prompt concise but descriptive (20-50 words).
- Consider the shooting scenario/category when generating the prompt.
- The prompt should be suitable for injecting into a larger AI image generation prompt.`,
            },
            {
              role: 'user',
              content: `中文姿势名称："${label.trim()}"，拍摄场景：${categoryHint}。请生成对应的英文 fashion pose prompt。`,
            },
          ],
        }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const raw = await response.text()
      console.log(`[Generate Pose Prompt] status=${response.status}, raw=${raw.slice(0, 300)}`)

      if (!response.ok) {
        console.error('[Generate Pose Prompt] API error:', response.status, raw)
        return NextResponse.json({ message: 'AI 生成失败' }, { status: 500 })
      }

      let data: any
      try {
        data = JSON.parse(raw)
      } catch {
        console.error('[Generate Pose Prompt] Invalid JSON:', raw)
        return NextResponse.json({ message: 'AI 返回格式异常' }, { status: 500 })
      }

      // 兼容 content 为字符串或数组的情况
      const content = data.choices?.[0]?.message?.content
      let prompt = ''
      if (typeof content === 'string') {
        prompt = content.trim()
      } else if (Array.isArray(content)) {
        prompt = content
          .map((item: any) => {
            if (typeof item === 'string') return item
            if (item?.text) return item.text
            return ''
          })
          .filter(Boolean)
          .join(' ')
          .trim()
      }

      if (!prompt) {
        console.error('[Generate Pose Prompt] Empty content, full response:', JSON.stringify(data).slice(0, 500))
        return NextResponse.json({ message: 'AI 未返回有效内容' }, { status: 500 })
      }

      return NextResponse.json({ prompt })
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    console.error('[Generate Pose Prompt Error]', error)
    return NextResponse.json({ message: '生成 Prompt 失败' }, { status: 500 })
  }
}
