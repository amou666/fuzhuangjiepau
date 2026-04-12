import { db } from './db'

interface WatermarkConfig {
  enabled: boolean
  text: string
  position: string
  opacity: number
  fontSize: number
}

let cachedConfig: WatermarkConfig | null = null
let cacheTime = 0

export function getWatermarkConfig(): WatermarkConfig {
  if (cachedConfig && Date.now() - cacheTime < 30_000) return cachedConfig

  try {
    const row = db.prepare('SELECT * FROM WatermarkConfig WHERE id = ?').get('global') as any
    if (!row) return { enabled: false, text: '', position: 'bottom-right', opacity: 0.3, fontSize: 16 }
    cachedConfig = {
      enabled: !!row.enabled,
      text: row.text || '',
      position: row.position || 'bottom-right',
      opacity: row.opacity ?? 0.3,
      fontSize: row.fontSize ?? 16,
    }
    cacheTime = Date.now()
    return cachedConfig
  } catch {
    return { enabled: false, text: '', position: 'bottom-right', opacity: 0.3, fontSize: 16 }
  }
}

export function buildWatermarkSvg(width: number, height: number): Buffer | null {
  const config = getWatermarkConfig()
  if (!config.enabled || !config.text.trim()) return null

  const fontSize = config.fontSize
  const text = config.text.trim()
  const opacity = config.opacity

  let x = width - 20
  let y = height - 20
  let anchor = 'end'

  switch (config.position) {
    case 'top-left': x = 20; y = fontSize + 20; anchor = 'start'; break
    case 'top-right': x = width - 20; y = fontSize + 20; anchor = 'end'; break
    case 'bottom-left': x = 20; y = height - 20; anchor = 'start'; break
    case 'center': x = width / 2; y = height / 2; anchor = 'middle'; break
    default: break
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="white" fill-opacity="${opacity}" text-anchor="${anchor}" font-weight="bold" style="text-shadow: 0 1px 3px rgba(0,0,0,0.5)">${escapeXml(text)}</text>
  </svg>`

  return Buffer.from(svg)
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
