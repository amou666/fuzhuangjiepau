import { create } from 'zustand';

// ─── 各页面的生成状态 ──────────────────────────────────────────
// SPA 路由切换时组件卸载，本地 useState 会丢失；
// 将生成状态提升到全局 store，切换回来时自动恢复。

// ─── Redesign ──────────────────────────────────────────────────
export interface RedesignGenState {
  submitting: boolean;
  progress: string;
  resultUrls: string[];
  pendingCount: number;
  generatedItems: string[];
  error: string;
}

// ─── Model Fusion ──────────────────────────────────────────────
export interface FusionGenState {
  submitting: boolean;
  resultUrl: string;
  resultUrls: string[];
  error: string;
}

// ─── Recolor ───────────────────────────────────────────────────
export interface RecolorGenState {
  submitting: boolean;
  progress: string;
  results: Array<{ url: string; label: string }>;
  error: string;
}

// ─── Ghost Mannequin ───────────────────────────────────────────
export interface GhostMannequinGenState {
  isGenerating: boolean;
  progress: number;
  genStatus: string;
  resultUrl: string | null;
  errorMessage: string;
}

// ─── Production Sheet ──────────────────────────────────────────
export interface ProductionSheetGenState {
  isProcessing: boolean;
  error: string;
  showTable: boolean;
}

// ─── Quick Workspace ───────────────────────────────────────────
// quick-workspace 已使用 taskStore 管理轮询状态，
// 这里只保存 UI 层面的 submitting / error
export interface QuickWorkspaceGenState {
  submitting: boolean;
  error: string;
}

// ─── Store Interface ───────────────────────────────────────────
interface GenerationState {
  redesign: RedesignGenState;
  fusion: FusionGenState;
  recolor: RecolorGenState;
  ghostMannequin: GhostMannequinGenState;
  productionSheet: ProductionSheetGenState;
  quickWorkspace: QuickWorkspaceGenState;

  // Redesign
  setRedesignGen: (patch: Partial<RedesignGenState>) => void;
  clearRedesignGen: () => void;

  // Model Fusion
  setFusionGen: (patch: Partial<FusionGenState>) => void;
  clearFusionGen: () => void;

  // Recolor
  setRecolorGen: (patch: Partial<RecolorGenState>) => void;
  clearRecolorGen: () => void;

  // Ghost Mannequin
  setGhostMannequinGen: (patch: Partial<GhostMannequinGenState>) => void;
  clearGhostMannequinGen: () => void;

  // Production Sheet
  setProductionSheetGen: (patch: Partial<ProductionSheetGenState>) => void;
  clearProductionSheetGen: () => void;

  // Quick Workspace
  setQuickWorkspaceGen: (patch: Partial<QuickWorkspaceGenState>) => void;
  clearQuickWorkspaceGen: () => void;
}

// ─── Defaults ──────────────────────────────────────────────────
const defaultRedesign: RedesignGenState = {
  submitting: false,
  progress: '',
  resultUrls: [],
  pendingCount: 0,
  generatedItems: [],
  error: '',
};

const defaultFusion: FusionGenState = {
  submitting: false,
  resultUrl: '',
  resultUrls: [],
  error: '',
};

const defaultRecolor: RecolorGenState = {
  submitting: false,
  progress: '',
  results: [],
  error: '',
};

const defaultGhostMannequin: GhostMannequinGenState = {
  isGenerating: false,
  progress: 0,
  genStatus: '就绪',
  resultUrl: null,
  errorMessage: '',
};

const defaultProductionSheet: ProductionSheetGenState = {
  isProcessing: false,
  error: '',
  showTable: false,
};

const defaultQuickWorkspace: QuickWorkspaceGenState = {
  submitting: false,
  error: '',
};

// ─── Store ─────────────────────────────────────────────────────
export const useGenerationStore = create<GenerationState>()((set) => ({
  redesign: { ...defaultRedesign },
  fusion: { ...defaultFusion },
  recolor: { ...defaultRecolor },
  ghostMannequin: { ...defaultGhostMannequin },
  productionSheet: { ...defaultProductionSheet },
  quickWorkspace: { ...defaultQuickWorkspace },

  setRedesignGen: (patch) =>
    set((s) => ({ redesign: { ...s.redesign, ...patch } })),
  clearRedesignGen: () =>
    set({ redesign: { ...defaultRedesign } }),

  setFusionGen: (patch) =>
    set((s) => ({ fusion: { ...s.fusion, ...patch } })),
  clearFusionGen: () =>
    set({ fusion: { ...defaultFusion } }),

  setRecolorGen: (patch) =>
    set((s) => ({ recolor: { ...s.recolor, ...patch } })),
  clearRecolorGen: () =>
    set({ recolor: { ...defaultRecolor } }),

  setGhostMannequinGen: (patch) =>
    set((s) => ({ ghostMannequin: { ...s.ghostMannequin, ...patch } })),
  clearGhostMannequinGen: () =>
    set({ ghostMannequin: { ...defaultGhostMannequin } }),

  setProductionSheetGen: (patch) =>
    set((s) => ({ productionSheet: { ...s.productionSheet, ...patch } })),
  clearProductionSheetGen: () =>
    set({ productionSheet: { ...defaultProductionSheet } }),

  setQuickWorkspaceGen: (patch) =>
    set((s) => ({ quickWorkspace: { ...s.quickWorkspace, ...patch } })),
  clearQuickWorkspaceGen: () =>
    set({ quickWorkspace: { ...defaultQuickWorkspace } }),
}));
