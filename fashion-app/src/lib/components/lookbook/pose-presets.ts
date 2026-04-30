/**
 * 套图模式 — 姿势预设数据
 *
 * 数据从云端（/api/pose-presets）加载，管理员可在后台管理。
 * 本文件仅提供类型定义和加载函数，本地无硬编码数据。
 */

export interface PosePreset {
  id: string
  category: string
  label: string
  /** 注入 extraPrompt 的英文姿势描述 */
  prompt: string
  /** 缩略图 URL（用户上传的姿势参考图） */
  thumbnailUrl: string | null
  sortOrder: number
}

export interface PoseCategory {
  id: string
  label: string
  /** 分类描述 */
  desc: string
  poses: PosePreset[]
}

/** 从 API 加载姿势预设分类列表 */
export async function fetchPosePresets(): Promise<PoseCategory[]> {
  try {
    const res = await fetch('/api/pose-presets')
    if (!res.ok) throw new Error('Failed to fetch')
    const data = await res.json()
    return data.categories || []
  } catch (err) {
    console.error('[fetchPosePresets]', err)
    return []
  }
}

/** 根据 pose id 在分类列表中查找预设 */
export function findPoseById(categories: PoseCategory[], id: string): PosePreset | undefined {
  for (const cat of categories) {
    const found = cat.poses.find((p) => p.id === id)
    if (found) return found
  }
  return undefined
}

/** 默认选中的姿势（前端初始值，实际使用前 3 个可用姿势） */
export function getDefaultSelectedPoses(categories: PoseCategory[]): string[] {
  const all = categories.flatMap((c) => c.poses)
  return all.slice(0, 3).map((p) => p.id)
}

/** 批量生成数量选项 */
export const BATCH_COUNT_OPTIONS = [
  { value: 3, label: '3 张', creditCost: 3 },
  { value: 5, label: '5 张', creditCost: 5 },
  { value: 8, label: '8 张', creditCost: 8 },
]

/** 批量变体类型 */
export type BatchVariationType = 'pose' | 'scene' | 'both'

export const BATCH_VARIATION_OPTIONS: { value: BatchVariationType; label: string; desc: string }[] = [
  { value: 'pose', label: '变换姿势', desc: '同一场景，不同角度与动作' },
  { value: 'scene', label: '变换场景', desc: '同一姿势，不同背景氛围' },
  { value: 'both', label: '姿势+场景', desc: '姿势和场景都变化' },
]
