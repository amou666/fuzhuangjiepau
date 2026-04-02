export type Role = 'ADMIN' | 'CUSTOMER';
export type TaskStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface JwtUser {
  userId: string;
  email: string;
  role: Role;
}

export interface ModelConfig {
  mode: 'upload' | 'generate';
  imageUrl?: string;
  gender: string;
  skinTone: string;
  bodyType: string;
  pose: string;
  expression: string;
}

export interface SceneConfig {
  mode: 'upload' | 'preset';
  imageUrl?: string;
  preset: string;
  prompt: string;
}

export interface TaskPayload {
  clothingUrl: string;
  modelConfig: ModelConfig;
  sceneConfig: SceneConfig;
}
