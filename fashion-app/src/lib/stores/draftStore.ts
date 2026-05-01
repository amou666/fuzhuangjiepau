import { create } from 'zustand';
import type { QuickWorkspaceAspectRatio, QuickWorkspaceFraming, QuickWorkspaceMode } from '@/lib/types';
import { isValidDeviceId } from '@/lib/device-presets';

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

// ─── Quick Workspace Live State ──────────────────────────────
// 组件不再用 useState + useEffect 恢复，直接从 store 读取，
// mount 时 0 延迟，SPA 路由切换回来状态完整保留。
export interface QuickWorkspaceState {
  mode: QuickWorkspaceMode;
  clothingUrl: string;
  clothingBackUrl: string;
  modelImageUrl: string;
  sceneImageUrl: string;
  aspectRatio: QuickWorkspaceAspectRatio;
  framing: QuickWorkspaceFraming;
  device: string;
  extraPrompt: string;
  lookbookMode: boolean;
}

const DEFAULT_QW_STATE: QuickWorkspaceState = {
  mode: 'background',
  clothingUrl: '',
  clothingBackUrl: '',
  modelImageUrl: '',
  sceneImageUrl: '',
  aspectRatio: '3:4',
  framing: 'auto',
  device: 'phone',
  extraPrompt: '',
  lookbookMode: false,
};

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

  // Quick Workspace (legacy draft — kept for backward compat)
  quickWorkspaceDraft: QuickWorkspaceDraft | null;
  setQuickWorkspaceDraft: (draft: QuickWorkspaceDraft) => void;
  clearQuickWorkspaceDraft: () => void;

  // Quick Workspace Live State — 组件直接读写的完整运行时状态
  qw: QuickWorkspaceState;
  setQw: <K extends keyof QuickWorkspaceState>(key: K, value: QuickWorkspaceState[K]) => void;
  setQwBatch: (partial: Partial<QuickWorkspaceState>) => void;
  resetQw: () => void;
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

  // Quick Workspace (legacy draft — 调用时自动同步到 qw)
  quickWorkspaceDraft: null,
  setQuickWorkspaceDraft: (draft) => set((s) => ({
    quickWorkspaceDraft: draft,
    // 自动同步到 qw，确保工作台直接读到最新值
    qw: {
      ...s.qw,
      mode: draft.mode ?? s.qw.mode,
      clothingUrl: draft.clothingUrl ?? s.qw.clothingUrl,
      clothingBackUrl: draft.clothingBackUrl ?? s.qw.clothingBackUrl,
      modelImageUrl: draft.modelImageUrl ?? s.qw.modelImageUrl,
      sceneImageUrl: draft.sceneImageUrl ?? s.qw.sceneImageUrl,
      aspectRatio: draft.aspectRatio ?? s.qw.aspectRatio,
      framing: draft.framing ?? s.qw.framing,
      device: draft.device && isValidDeviceId(draft.device) ? draft.device : s.qw.device,
      extraPrompt: draft.extraPrompt ?? s.qw.extraPrompt,
    },
  })),
  clearQuickWorkspaceDraft: () => set({ quickWorkspaceDraft: null }),

  // Quick Workspace Live State
  qw: { ...DEFAULT_QW_STATE },
  setQw: (key, value) => set((s) => ({ qw: { ...s.qw, [key]: value } })),
  setQwBatch: (partial) => set((s) => ({ qw: { ...s.qw, ...partial } })),
  resetQw: () => set({ qw: { ...DEFAULT_QW_STATE }, quickWorkspaceDraft: null }),
}));

// 清理历史遗留的 localStorage 草稿（旧版本曾把图片 URL 持久化到 localStorage）
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('fashion-ai-draft');
  } catch {
    // 忽略 storage 不可用情况（隐私模式等）
  }
}
