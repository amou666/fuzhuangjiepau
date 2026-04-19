export type Role = 'ADMIN' | 'CUSTOMER'
export type TaskStatus = 'PENDING' | 'PROCESSING' | 'DESCRIBING_MODEL' | 'DESCRIBING_SCENE' | 'GENERATING' | 'COMPLETED' | 'FAILED'

// ─── Raw DB row types (SQLite returns these before JSON-parsing) ───

export interface UserRow {
  id: string
  email: string
  password: string
  role: string
  apiKey: string | null
  credits: number
  isActive: number
  createdAt: string
  updatedAt: string
}

export interface GenerationTaskRow {
  id: string
  userId: string
  status: string
  type: string
  creditCost: number
  clothingUrl: string
  clothingBackUrl: string | null
  clothingDetailUrls: string
  clothingDescription: string | null
  modelConfig: string
  sceneConfig: string
  resultUrl: string | null
  resultUrls: string
  upscaledUrl: string | null
  upscaleFactor: number | null
  errorMsg: string | null
  createdAt: string
  updatedAt: string
  finishedAt: string | null
}

export interface CreditLogRow {
  id: string
  userId: string
  delta: number
  balanceAfter: number
  reason: string
  createdAt: string
}

export interface NotificationRow {
  id: string
  userId: string | null
  type: string
  title: string
  content: string
  isRead: number
  createdAt: string
}

export interface FavoriteRow {
  id: string
  userId: string
  type: string
  name: string
  data: string
  previewUrl: string | null
  createdAt: string
}

export interface User {
  id: string
  email: string
  role: Role
  apiKey: string
  credits: number
  isActive: boolean
  createdAt: string
  taskCount?: number
}

export interface JwtUser {
  userId: string
  email: string
  role: Role
}

export interface ModelConfig {
  mode: 'upload' | 'generate'
  imageUrl?: string
  category: string
  age: string
  ethnicity: string
  gender: string
  skinTone: string
  bodyType: string
  height?: string
  faceShape?: string
  hairStyle?: string
  hairColor?: string
  faceFeature: string
  pose: string
  expression: string
  /** 与 category 等枚举对应的完整英文 casting 段落，提交任务时由前后端一并写入 */
  castingNarrative?: string
}

export interface SceneConfig {
  mode: 'preset' | 'replace'
  imageUrl?: string
  sceneSource: 'preset' | 'upload'
  preset: string
  timeOfDay?: string
  lighting?: string
  composition?: string
  depthOfField?: 'slight' | 'shallow' | 'deep'
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9'
  grain?: 'none' | 'light' | 'heavy'
  exposureMode?: 'natural' | 'bright' | 'dark'
  prompt: string
  /** 批量生成时写入，提示词中强化「同套穿搭」锁定，避免每张图随机换包/首饰 */
  batchVariation?: 'pose' | 'scene' | 'both'
  /** 快速工作台模式标识：'background' 纯背景 / 'fusion' 含原人物（用作姿势参考） */
  quickMode?: 'background' | 'fusion'
  /** 快速工作台取景偏好：'auto' | 'half' | 'full' */
  quickFraming?: 'auto' | 'half' | 'full'
}

export type QuickWorkspaceMode = 'background' | 'fusion'
export type QuickWorkspaceAspectRatio = '3:4' | '1:1' | '4:3' | '16:9' | '9:16'
export type QuickWorkspaceFraming = 'auto' | 'half' | 'full'

export interface QuickWorkspacePayload {
  clothingUrl: string
  clothingBackUrl?: string
  modelImageUrl: string
  sceneImageUrl: string
  mode: QuickWorkspaceMode
  aspectRatio?: QuickWorkspaceAspectRatio
  framing?: QuickWorkspaceFraming
  extraPrompt?: string
}

export type ClothingLength = 'cropped' | 'standard' | 'hip-length' | 'knee-length' | 'ankle-length'

export interface TaskPayload {
  clothingUrl: string
  clothingBackUrl?: string
  clothingDetailUrls?: string[]
  clothingLength?: ClothingLength
  modelConfig: ModelConfig
  sceneConfig: SceneConfig
}

export interface GenerationTask {
  id: string
  userId: string
  status: string
  type: 'workspace' | 'model-fusion' | 'redesign' | 'quick-workspace'
  creditCost: number
  clothingUrl: string
  clothingBackUrl?: string | null
  clothingDetailUrls?: string | null
  clothingDescription?: string | null
  modelConfig: ModelConfig
  sceneConfig: SceneConfig
  resultUrl?: string | null
  resultUrls?: string[]
  upscaledUrl?: string | null
  upscaleFactor?: number | null
  errorMsg?: string | null
  createdAt: string
  updatedAt: string
  finishedAt?: string | null
  user?: { email: string }
}

export interface CreditLog {
  id: string
  userId: string
  delta: number
  balanceAfter: number
  reason: string
  createdAt: string
  user?: { email: string }
}

export interface AuditLog {
  id: string
  adminId: string
  action: string
  targetUserId?: string | null
  detail: string
  createdAt: string
  admin: { email: string }
  targetUser?: { email: string } | null
}

export interface Customer {
  id: string
  email: string
  role: string
  apiKey: string
  credits: number
  isActive: boolean
  createdAt: string
  taskCount: number
}

export interface DashboardResponse {
  summary: {
    customerCount: number
    taskCount: number
    totalCreditsConsumed: number
    activeCustomerCount: number
  }
  dailyTasks: Array<{ date: string; count: number }>
  topCustomers: Array<{ email: string; spent: number }>
  recentTasks: Array<GenerationTask & { user?: { email: string } }>
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

export type FavoriteType = 'clothing' | 'model' | 'scene' | 'full'

export interface Favorite {
  id: string
  userId: string
  type: FavoriteType
  name: string
  data: ModelConfig | SceneConfig | Record<string, unknown>
  previewUrl?: string | null
  createdAt: string
}
