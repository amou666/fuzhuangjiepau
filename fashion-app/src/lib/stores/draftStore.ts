import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'fashion-ai-draft',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          const memoryStore = new Map<string, string>();
          return {
            getItem: (name: string) => memoryStore.get(name) ?? null,
            setItem: (name: string, value: string) => { memoryStore.set(name, value); },
            removeItem: (name: string) => { memoryStore.delete(name); },
          };
        }
        return localStorage;
      }),
      partialize: (state) => ({
        redesignDraft: state.redesignDraft,
        fusionDraft: state.fusionDraft,
        quickWorkspaceDraft: state.quickWorkspaceDraft,
      }),
    },
  ),
);
