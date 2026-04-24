import { create } from 'zustand';
import type { QuickWorkspaceAspectRatio, QuickWorkspaceFraming, QuickWorkspaceMode } from '@/lib/types';

// ─── Redesign Draft ──────────────────────────────────────────
export type RedesignMode = 'luxury-color' | 'material-element' | 'material-silhouette' | 'commercial-brainstorm';

export interface RedesignDraft {
  imageUrl: string;
  mode: RedesignMode;
  customPrompt: string;
  constraints: string;
  count: number;
}

export interface RedesignResult {
  resultUrls: string[];
  generatedItems: string[];
  imageUrl: string;
  mode: RedesignMode;
}

// ─── Model Fusion Draft ──────────────────────────────────────
export interface FusionDraft {
  model1: string;
  model2: string;
  model3: string;
}

export interface FusionResult {
  resultUrl: string;
  modelUrls: string[];
}

// ─── Quick Workspace Draft ───────────────────────────────────
export interface QuickWorkspaceDraft {
  mode: QuickWorkspaceMode;
  clothingUrl: string;
  clothingBackUrl: string;
  modelImageUrl: string;
  sceneImageUrl: string;
  aspectRatio: QuickWorkspaceAspectRatio;
  framing: QuickWorkspaceFraming;
  /** 拍摄设备预设 id；'auto' 表示不指定；可选，未设置时回退 'auto' */
  device?: string;
  extraPrompt: string;
}

// ─── Store ───────────────────────────────────────────────────
// 仅在内存中保存，不做 localStorage 持久化：
//   • 浏览器内 SPA 路由切换 → 模块单例依然存活 → 已上传图片保留
//   • 刷新 / 关闭重开标签页 → JS 运行时重启 → 草稿自动清空
// 如需跨刷新保留设置，请考虑单独存入 localStorage（当前需求不需要）。
interface DraftState {
  // Redesign
  redesignDraft: RedesignDraft | null;
  redesignResult: RedesignResult | null;
  setRedesignDraft: (draft: RedesignDraft) => void;
  clearRedesignDraft: () => void;
  setRedesignResult: (result: RedesignResult) => void;
  clearRedesignResult: () => void;

  // Model Fusion
  fusionDraft: FusionDraft | null;
  fusionResult: FusionResult | null;
  setFusionDraft: (draft: FusionDraft) => void;
  clearFusionDraft: () => void;
  setFusionResult: (result: FusionResult) => void;
  clearFusionResult: () => void;

  // Quick Workspace
  quickWorkspaceDraft: QuickWorkspaceDraft | null;
  setQuickWorkspaceDraft: (draft: QuickWorkspaceDraft) => void;
  clearQuickWorkspaceDraft: () => void;
}

export const useDraftStore = create<DraftState>()((set) => ({
  // Redesign
  redesignDraft: null,
  redesignResult: null,
  setRedesignDraft: (draft) => set({ redesignDraft: draft }),
  clearRedesignDraft: () => set({ redesignDraft: null }),
  setRedesignResult: (result) => set({ redesignResult: result }),
  clearRedesignResult: () => set({ redesignResult: null }),

  // Model Fusion
  fusionDraft: null,
  fusionResult: null,
  setFusionDraft: (draft) => set({ fusionDraft: draft }),
  clearFusionDraft: () => set({ fusionDraft: null }),
  setFusionResult: (result) => set({ fusionResult: result }),
  clearFusionResult: () => set({ fusionResult: null }),

  // Quick Workspace
  quickWorkspaceDraft: null,
  setQuickWorkspaceDraft: (draft) => set({ quickWorkspaceDraft: draft }),
  clearQuickWorkspaceDraft: () => set({ quickWorkspaceDraft: null }),
}));

// 清理历史遗留的 localStorage 草稿（旧版本曾把图片 URL 持久化到 localStorage）
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('fashion-ai-draft');
  } catch {
    // 忽略 storage 不可用情况（隐私模式等）
  }
}
