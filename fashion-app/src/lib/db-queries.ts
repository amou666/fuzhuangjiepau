/**
 * 类型安全的数据库查询层
 *
 * 用法：
 *   import { queries } from '@/lib/db-queries'
 *   const user = queries.user.findById('xxx')  // 返回 UserPublicRow | undefined，无需 as any
 *   const task = queries.task.findById('yyy')   // 返回 TaskRow | undefined
 */

import { db } from './db'
import type { UserRow, GenerationTaskRow, CreditLogRow, NotificationRow, PosePreset, FavoriteRow } from './types'

// ─── 通用聚合结果类型 ───

interface CountRow { count: number }
interface TotalRow { total: number }

// ─── User ───

interface UserPublicRow {
  id: string
  email: string
  role: string
  apiKey: string | null
  credits: number
  isActive: number
  createdAt: string
  updatedAt: string
}

interface UserCreditsApiKeyRow {
  credits: number
  apiKey: string | null
}

interface UserCreditsRow {
  credits: number
}

interface UserSimpleRow {
  id: string
  email: string
  credits: number
}

const userStmts = {
  findById: db.prepare<[string], UserPublicRow>('SELECT id, email, role, apiKey, credits, isActive, createdAt, updatedAt FROM User WHERE id = ?'),
  findByEmail: db.prepare<[string], UserPublicRow>('SELECT id, email, role, apiKey, credits, isActive, createdAt, updatedAt FROM User WHERE email = ?'),
  findAuthByEmail: db.prepare<[string], UserRow>('SELECT * FROM User WHERE email = ?'),
  findAuthById: db.prepare<[string], UserRow>('SELECT * FROM User WHERE id = ?'),
  findApiKeyByUserId: db.prepare<[string], Pick<UserRow, 'apiKey'>>('SELECT apiKey FROM User WHERE id = ?'),
  findRoleByUserId: db.prepare<[string], Pick<UserRow, 'role'>>('SELECT role FROM User WHERE id = ?'),
  findIsActiveById: db.prepare<[string], Pick<UserRow, 'isActive'>>('SELECT isActive FROM User WHERE id = ?'),
  findCreditsById: db.prepare<[string], UserCreditsRow>('SELECT credits FROM User WHERE id = ?'),
  findCreditsAndApiKeyByUserId: db.prepare<[string], UserCreditsApiKeyRow>('SELECT credits, apiKey FROM User WHERE id = ?'),
  findSimpleById: db.prepare<[string], UserSimpleRow>('SELECT id, email, credits FROM User WHERE id = ?'),
}

export const userQueries = {
  findById(id: string): UserPublicRow | undefined {
    return userStmts.findById.get(id)
  },
  findByEmail(email: string): UserPublicRow | undefined {
    return userStmts.findByEmail.get(email)
  },
  /** 含密码，仅在认证流程中使用 */
  findAuthByEmail(email: string): UserRow | undefined {
    return userStmts.findAuthByEmail.get(email)
  },
  /** 含密码，仅在认证流程中使用 */
  findAuthById(id: string): UserRow | undefined {
    return userStmts.findAuthById.get(id)
  },
  findApiKey(id: string): string | null | undefined {
    return userStmts.findApiKeyByUserId.get(id)?.apiKey
  },
  findRole(id: string): string | undefined {
    return userStmts.findRoleByUserId.get(id)?.role
  },
  findIsActive(id: string): number | undefined {
    return userStmts.findIsActiveById.get(id)?.isActive
  },
  findCredits(id: string): number | undefined {
    return userStmts.findCreditsById.get(id)?.credits
  },
  findCreditsAndApiKey(id: string): UserCreditsApiKeyRow | undefined {
    return userStmts.findCreditsAndApiKeyByUserId.get(id)
  },
  findSimpleById(id: string): UserSimpleRow | undefined {
    return userStmts.findSimpleById.get(id)
  },
}

// ─── GenerationTask ───

interface TaskModelConfigRow { modelConfig: string }
interface TaskSceneConfigRow { sceneConfig: string }

const taskStmts = {
  findById: db.prepare<[string], GenerationTaskRow>(
    'SELECT id, userId, status, type, creditCost, clothingUrl, clothingBackUrl, clothingDetailUrls, clothingDescription, modelConfig, sceneConfig, resultUrl, resultUrls, upscaledUrl, upscaleFactor, errorMsg, createdAt, updatedAt, finishedAt FROM GenerationTask WHERE id = ?'
  ),
  findStatusById: db.prepare<[string], Pick<GenerationTaskRow, 'id' | 'status' | 'resultUrl' | 'upscaledUrl' | 'errorMsg'>>(
    'SELECT id, status, resultUrl, upscaledUrl, errorMsg FROM GenerationTask WHERE id = ?'
  ),
  findMetaById: db.prepare<[string], Pick<GenerationTaskRow, 'userId' | 'creditCost' | 'type'>>(
    'SELECT userId, creditCost, type FROM GenerationTask WHERE id = ?'
  ),
  countByUserId: db.prepare<[string], CountRow>('SELECT COUNT(*) as count FROM GenerationTask WHERE userId = ?'),
  countByUserIdAndStatus: db.prepare<[string, string], CountRow>('SELECT COUNT(*) as count FROM GenerationTask WHERE userId = ? AND status = ?'),
  findModelConfigByUserId: db.prepare<[string], TaskModelConfigRow>('SELECT modelConfig FROM GenerationTask WHERE userId = ?'),
  findSceneConfigByUserId: db.prepare<[string], TaskSceneConfigRow>('SELECT sceneConfig FROM GenerationTask WHERE userId = ?'),
  findByIdAndUserId: db.prepare<[string, string], GenerationTaskRow>(
    'SELECT id, userId, status, type, creditCost, clothingUrl, clothingBackUrl, clothingDetailUrls, clothingDescription, modelConfig, sceneConfig, resultUrl, resultUrls, upscaledUrl, upscaleFactor, errorMsg, createdAt, updatedAt, finishedAt FROM GenerationTask WHERE id = ? AND userId = ?'
  ),
  findByIdsAndUserId: (placeholders: string) =>
    db.prepare<[...string[], string], GenerationTaskRow>(
      `SELECT id, userId, status, type, creditCost, clothingUrl, clothingBackUrl, clothingDetailUrls, clothingDescription, modelConfig, sceneConfig, resultUrl, resultUrls, upscaledUrl, upscaleFactor, errorMsg, createdAt, updatedAt, finishedAt FROM GenerationTask WHERE id IN (${placeholders}) AND userId = ?`
    ),
}

export const taskQueries = {
  findById(id: string): GenerationTaskRow | undefined {
    return taskStmts.findById.get(id)
  },
  findStatusById(id: string) {
    return taskStmts.findStatusById.get(id)
  },
  findMetaById(id: string) {
    return taskStmts.findMetaById.get(id)
  },
  countByUserId(userId: string): number {
    return taskStmts.countByUserId.get(userId)?.count ?? 0
  },
  countByUserIdAndStatus(userId: string, status: string): number {
    return taskStmts.countByUserIdAndStatus.get(userId, status)?.count ?? 0
  },
  findModelConfigsByUserId(userId: string): TaskModelConfigRow[] {
    return taskStmts.findModelConfigByUserId.all(userId)
  },
  findSceneConfigsByUserId(userId: string): TaskSceneConfigRow[] {
    return taskStmts.findSceneConfigByUserId.all(userId)
  },
  findByIdAndUserId(id: string, userId: string): GenerationTaskRow | undefined {
    return taskStmts.findByIdAndUserId.get(id, userId)
  },
  findByIdsAndUserId(ids: string[], userId: string): GenerationTaskRow[] {
    const placeholders = ids.map(() => '?').join(',')
    return taskStmts.findByIdsAndUserId(placeholders).all(...ids, userId)
  },
}

// ─── CreditLog ───

const creditLogStmts = {
  findByIdsForDedup: db.prepare<[string, string], Pick<CreditLogRow, 'id'>>(
    'SELECT id FROM CreditLog WHERE userId = ? AND reason = ? LIMIT 1'
  ),
  countByUserId: db.prepare<[string], CountRow>('SELECT COUNT(*) as count FROM CreditLog WHERE userId = ?'),
  sumAbsDeltaByUserId: db.prepare<[string], TotalRow>('SELECT COALESCE(SUM(ABS(delta)), 0) as total FROM CreditLog WHERE userId = ? AND delta < 0'),
  sumPositiveDeltaByUserId: db.prepare<[string], TotalRow>('SELECT COALESCE(SUM(delta), 0) as total FROM CreditLog WHERE userId = ? AND delta > 0'),
  countByUserIdWithFilter: (whereClause: string, paramCount: number) => {
    const params = Array(paramCount).fill('?').join(',')
    return db.prepare<string[], CountRow>(`SELECT COUNT(*) as count FROM CreditLog cl ${whereClause}`)
  },
  findHistoryByUserId: db.prepare<[string, number, number], CreditLogRow>(
    'SELECT id, userId, delta, balanceAfter, reason, createdAt FROM CreditLog WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?'
  ),
}

export const creditLogQueries = {
  existsDedupEntry(userId: string, reason: string): boolean {
    return creditLogStmts.findByIdsForDedup.get(userId, reason) !== undefined
  },
  countByUserId(userId: string): number {
    return creditLogStmts.countByUserId.get(userId)?.count ?? 0
  },
  sumSpentByUserId(userId: string): number {
    return creditLogStmts.sumAbsDeltaByUserId.get(userId)?.total ?? 0
  },
  sumRechargedByUserId(userId: string): number {
    return creditLogStmts.sumPositiveDeltaByUserId.get(userId)?.total ?? 0
  },
  findHistoryByUserId(userId: string, limit: number, offset: number): CreditLogRow[] {
    return creditLogStmts.findHistoryByUserId.all(userId, limit, offset)
  },
}

// ─── Notification ───

const notifStmts = {
  findByUserId: db.prepare<[string], NotificationRow>(
    'SELECT id, userId, type, title, content, isRead, createdAt FROM Notification WHERE userId = ? OR userId IS NULL ORDER BY createdAt DESC LIMIT 50'
  ),
  countUnreadByUserId: db.prepare<[string], CountRow>(
    'SELECT COUNT(*) as count FROM Notification WHERE (userId = ? OR userId IS NULL) AND isRead = 0'
  ),
}

export const notifQueries = {
  findByUserId(userId: string): NotificationRow[] {
    return notifStmts.findByUserId.all(userId)
  },
  countUnreadByUserId(userId: string): number {
    return notifStmts.countUnreadByUserId.get(userId)?.count ?? 0
  },
}

// ─── Favorite ───

const favStmts = {
  findByUserAndType: db.prepare<[string, string], FavoriteRow>(
    'SELECT id, userId, type, name, data, previewUrl, createdAt FROM Favorite WHERE userId = ? AND type = ? ORDER BY createdAt DESC'
  ),
  findByUser: db.prepare<[string], FavoriteRow>(
    'SELECT id, userId, type, name, data, previewUrl, createdAt FROM Favorite WHERE userId = ? ORDER BY createdAt DESC'
  ),
  findById: db.prepare<[string], FavoriteRow>('SELECT id, userId, type, name, data, previewUrl, createdAt FROM Favorite WHERE id = ?'),
  countByUserId: db.prepare<[string], CountRow>('SELECT COUNT(*) as count FROM Favorite WHERE userId = ?'),
}

export const favQueries = {
  findByUserAndType(userId: string, type: string): FavoriteRow[] {
    return favStmts.findByUserAndType.all(userId, type)
  },
  findByUser(userId: string): FavoriteRow[] {
    return favStmts.findByUser.all(userId)
  },
  findById(id: string): FavoriteRow | undefined {
    return favStmts.findById.get(id)
  },
  countByUserId(userId: string): number {
    return favStmts.countByUserId.get(userId)?.count ?? 0
  },
}

// ─── PosePreset ───

const poseStmts = {
  findActive: db.prepare<[], PosePreset>(
    'SELECT id, category, label, prompt, thumbnailUrl, sortOrder, isActive, createdAt, updatedAt FROM PosePreset WHERE isActive = 1 ORDER BY category, sortOrder ASC'
  ),
  findAll: db.prepare<[], PosePreset>(
    'SELECT id, category, label, prompt, thumbnailUrl, sortOrder, isActive, createdAt, updatedAt FROM PosePreset ORDER BY category, sortOrder ASC'
  ),
  findById: db.prepare<[string], PosePreset>('SELECT id, category, label, prompt, thumbnailUrl, sortOrder, isActive, createdAt, updatedAt FROM PosePreset WHERE id = ?'),
  findLabelById: db.prepare<[string], Pick<PosePreset, 'label'>>('SELECT label FROM PosePreset WHERE id = ?'),
}

export const poseQueries = {
  findActive(): PosePreset[] {
    return poseStmts.findActive.all()
  },
  findAll(): PosePreset[] {
    return poseStmts.findAll.all()
  },
  findById(id: string): PosePreset | undefined {
    return poseStmts.findById.get(id)
  },
  findLabelById(id: string): string | undefined {
    return poseStmts.findLabelById.get(id)?.label
  },
}

// ─── Template ───

interface TemplateRow {
  id: string
  name: string
  description: string
  category: string
  previewUrl: string | null
  clothingUrl: string | null
  modelConfig: string
  sceneConfig: string
  isActive: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

const tmplStmts = {
  findAll: db.prepare<[], TemplateRow>('SELECT id, name, description, category, previewUrl, clothingUrl, modelConfig, sceneConfig, isActive, sortOrder, createdAt, updatedAt FROM Template ORDER BY sortOrder ASC, createdAt DESC'),
  findById: db.prepare<[string], TemplateRow>('SELECT id, name, description, category, previewUrl, clothingUrl, modelConfig, sceneConfig, isActive, sortOrder, createdAt, updatedAt FROM Template WHERE id = ?'),
  findNameById: db.prepare<[string], Pick<TemplateRow, 'name'>>('SELECT name FROM Template WHERE id = ?'),
}

export const tmplQueries = {
  findAll(): TemplateRow[] {
    return tmplStmts.findAll.all()
  },
  findById(id: string): TemplateRow | undefined {
    return tmplStmts.findById.get(id)
  },
  findNameById(id: string): string | undefined {
    return tmplStmts.findNameById.get(id)?.name
  },
}

// ─── WatermarkConfig ───

interface WatermarkConfigRow {
  id: string
  enabled: number
  text: string
  position: string
  opacity: number
  fontSize: number
  updatedAt: string
}

const wmStmts = {
  findGlobal: db.prepare<[string], WatermarkConfigRow>('SELECT * FROM WatermarkConfig WHERE id = ?'),
}

export const wmQueries = {
  findGlobal(): WatermarkConfigRow | undefined {
    return wmStmts.findGlobal.get('global')
  },
}

// ─── ClothingCache ───

interface ClothingCacheMaterialRow {
  materialDesc: string | null
}

interface ClothingCacheDnaRow {
  materialDna: string | null
  category: string | null
  silhouette: string | null
}

const clothingCacheStmts = {
  findMaterialByUrl: db.prepare<[string], ClothingCacheMaterialRow>(
    'SELECT materialDesc FROM ClothingCache WHERE imageUrl = ?'
  ),
  findDnaByUrl: db.prepare<[string], ClothingCacheDnaRow>(
    'SELECT materialDna, category, silhouette FROM ClothingCache WHERE imageUrl = ?'
  ),
}

export const clothingCacheQueries = {
  findMaterialDesc(imageUrl: string): string | null | undefined {
    return clothingCacheStmts.findMaterialByUrl.get(imageUrl)?.materialDesc
  },
  findDna(imageUrl: string): ClothingCacheDnaRow | undefined {
    return clothingCacheStmts.findDnaByUrl.get(imageUrl)
  },
}

// ─── 统一导出 ───

export const queries = {
  user: userQueries,
  task: taskQueries,
  creditLog: creditLogQueries,
  notification: notifQueries,
  favorite: favQueries,
  pose: poseQueries,
  template: tmplQueries,
  watermark: wmQueries,
  clothingCache: clothingCacheQueries,
}
