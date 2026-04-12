import { create } from 'zustand';
import type { ClothingLength, ModelConfig, SceneConfig } from '@/lib/types';

// ─── Workspace Draft ─────────────────────────────────────────
export interface WorkspaceDraft {
  clothingUrl: string;
  clothingBackUrl: string;
  clothingDetailUrls: string[];
  clothingLength: ClothingLength | undefined;
  modelConfig: ModelConfig;
  sceneConfig: SceneConfig;
  step: number;
}

// ─── Redesign Draft ──────────────────────────────────────────
export type RedesignMode = 'luxury-color' | 'material-element' | 'material-silhouette' | 'commercial-brainstorm';

export interface RedesignDraft {
  imageUrl: string;
  mode: RedesignMode;
  customPrompt: string;
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

// ─── Store ───────────────────────────────────────────────────
interface DraftState {
  // Workspace
  workspaceDraft: WorkspaceDraft | null;
  setWorkspaceDraft: (draft: WorkspaceDraft) => void;
  clearWorkspaceDraft: () => void;

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
}

export const useDraftStore = create<DraftState>((set) => ({
  // Workspace
  workspaceDraft: null,
  setWorkspaceDraft: (draft) => set({ workspaceDraft: draft }),
  clearWorkspaceDraft: () => set({ workspaceDraft: null }),

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
}));
