import { db } from './db'
import { config } from './config'

export interface SystemConfigValues {
  aiModel: string
}

let cache: SystemConfigValues | null = null

function loadFromDb(): SystemConfigValues {
  let row = db
    .prepare('SELECT aiModel FROM SystemConfig WHERE id = ?')
    .get('global') as { aiModel: string } | undefined

  if (!row) {
    db.prepare('INSERT INTO SystemConfig (id, aiModel) VALUES (?, ?)').run('global', '')
    row = { aiModel: '' }
  }

  return { aiModel: row.aiModel ?? '' }
}

/** 返回数据库中存储的原始配置（不做回退处理） */
export function getSystemConfig(): SystemConfigValues {
  if (!cache) cache = loadFromDb()
  return { ...cache }
}

/** 返回真正生效的模型名：DB 非空 -> env -> 默认 */
export function getActiveAiModel(): string {
  const sc = getSystemConfig()
  if (sc.aiModel && sc.aiModel.trim()) return sc.aiModel.trim()
  return config.aiModel
}

/** 更新 system config（只允许传入已知字段） */
export function updateSystemConfig(partial: Partial<SystemConfigValues>): SystemConfigValues {
  const current = getSystemConfig()
  const next: SystemConfigValues = {
    aiModel: typeof partial.aiModel === 'string' ? partial.aiModel.trim() : current.aiModel,
  }

  db.prepare(
    "UPDATE SystemConfig SET aiModel = ?, updatedAt = datetime('now') WHERE id = ?"
  ).run(next.aiModel, 'global')

  cache = next
  return { ...next }
}

/** 测试 / 热更新场景下清缓存 */
export function invalidateSystemConfigCache(): void {
  cache = null
}
