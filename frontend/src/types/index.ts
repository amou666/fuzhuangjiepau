export type Role = 'ADMIN' | 'CUSTOMER';
export type TaskStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface User {
  id: string;
  email: string;
  role: Role;
  credits: number;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
}

export interface ModelConfig {
  mode: 'upload' | 'generate';
  imageUrl?: string;
  category: string;
  age: string;
  ethnicity: string;
  gender: string;
  skinTone: string;
  bodyType: string;
  pose: string;
  expression: string;
}

export interface SceneConfig {
  mode: 'upload' | 'preset' | 'replace';
  imageUrl?: string;
  preset: string;
  timeOfDay?: string;
  lighting?: string;
  composition?: string;
  depthOfField?: 'shallow' | 'deep';
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  prompt: string;
}

export interface GenerationTask {
  id: string;
  userId: string;
  status: TaskStatus;
  creditCost: number;
  clothingUrl: string;
  clothingDescription?: string | null;
  modelConfig: ModelConfig;
  sceneConfig: SceneConfig;
  resultUrl?: string | null;
  upscaledUrl?: string | null;
  upscaleFactor?: number | null;
  errorMsg?: string | null;
  createdAt: string;
  finishedAt?: string | null;
  user?: { email: string };
}

export interface CreditLog {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
  user?: { email: string; role: Role };
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  targetUserId?: string | null;
  detail: string;
  createdAt: string;
  admin: { email: string };
  targetUser?: { email: string } | null;
}

export interface Customer extends User {
  taskCount: number;
}

export interface DashboardResponse {
  summary: {
    customerCount: number;
    taskCount: number;
    totalCreditsConsumed: number;
    activeCustomerCount: number;
  };
  dailyTasks: Array<{ date: string; count: number }>;
  topCustomers: Array<{ email: string; spent: number }>;
  recentTasks: GenerationTask[];
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
