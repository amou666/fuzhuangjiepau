export type Role = 'ADMIN' | 'CUSTOMER'
export type TaskStatus = 'PENDING' | 'PROCESSING' | 'ANALYZING_CLOTHING' | 'DESCRIBING_MODEL' | 'DESCRIBING_SCENE' | 'GENERATING' | 'COMPLETED' | 'FAILED'

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
  pose: string
  expression: string
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
  prompt: string
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
  creditCost: number
  clothingUrl: string
  clothingBackUrl?: string | null
  clothingDetailUrls?: string | null
  clothingDescription?: string | null
  modelConfig: ModelConfig
  sceneConfig: SceneConfig
  resultUrl?: string | null
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
