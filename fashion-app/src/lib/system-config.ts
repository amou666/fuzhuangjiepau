import { db } from './db'
import { config } from './config'

/**
 * 系统级配置 — 目前只管两个模型：
 *   - aiModel        → 生图模型（默认 gpt-image-2-all）
 *   - analysisModel  → 分析模型（默认 nano-banana-2）
 *
 * 两者均支持：DB 空 → 回退到环境变量（config.*）→ 回退到内置默认。
 */
export interface SystemConfigValues {
  aiModel: string
  analysisModel: string
}

let cache: SystemConfigValues | null = null

function loadFromDb(): SystemConfigValues {
  let row = db
    .prepare('SELECT aiModel, analysisModel FROM SystemConfig WHERE id = ?')
    .get('global') as { aiModel: string; analysisModel: string } | undefined

  if (!row) {
    db.prepare('INSERT INTO SystemConfig (id, aiModel, analysisModel) VALUES (?, ?, ?)').run('global', '', '')
    row = { aiModel: '', analysisModel: '' }
  }

  return {
    aiModel: row.aiModel ?? '',
    analysisModel: row.analysisModel ?? '',
  }
}

/** 返回数据库中存储的原始配置（不做回退处理） */
export function getSystemConfig(): SystemConfigValues {
  if (!cache) cache = loadFromDb()
  return { ...cache }
}

/** 生效的生图模型：DB 非空 -> env -> 默认 gpt-image-2-all */
export function getActiveGenerationModel(): string {
  const sc = getSystemConfig()
  if (sc.aiModel && sc.aiModel.trim()) return sc.aiModel.trim()
  return config.aiModel
}

/** 生效的分析模型：DB 非空 -> env -> 默认 nano-banana-2 */
export function getActiveAnalysisModel(): string {
  const sc = getSystemConfig()
  if (sc.analysisModel && sc.analysisModel.trim()) return sc.analysisModel.trim()
  return config.analysisModel
}

/** 更新 system config（只允许传入已知字段，未传则保持当前值） */
export function updateSystemConfig(partial: Partial<SystemConfigValues>): SystemConfigValues {
  const current = getSystemConfig()
  const next: SystemConfigValues = {
    aiModel: typeof partial.aiModel === 'string' ? partial.aiModel.trim() : current.aiModel,
    analysisModel: typeof partial.analysisModel === 'string' ? partial.analysisModel.trim() : current.analysisModel,
  }

  db.prepare(
    "UPDATE SystemConfig SET aiModel = ?, analysisModel = ?, updatedAt = datetime('now') WHERE id = ?"
  ).run(next.aiModel, next.analysisModel, 'global')

  cache = next
  return { ...next }
}

/** 测试 / 热更新场景下清缓存 */
export function invalidateSystemConfigCache(): void {
  cache = null
}
