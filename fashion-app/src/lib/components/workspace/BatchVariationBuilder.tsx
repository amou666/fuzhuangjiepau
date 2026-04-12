'use client'

import { useState, useMemo } from 'react';
import type { ModelConfig, SceneConfig, ClothingLength, TaskPayload } from '@/lib/types';
import { poseOptions } from '@/lib/model-options';
import { SCENE_OPTIONS } from '@/lib/scene-options';
import { Layers, UserCircle, MapPin, Plus, X, Shuffle, Coins } from 'lucide-react';

interface BatchVariationBuilderProps {
  clothingUrl: string;
  clothingBackUrl?: string;
  clothingDetailUrls?: string[];
  clothingLength?: ClothingLength;
  baseModelConfig: ModelConfig;
  baseSceneConfig: SceneConfig;
  onSubmit: (tasks: TaskPayload[]) => void;
  isSubmitting: boolean;
  disabled: boolean;
}

const POSE_PRESETS = poseOptions.filter(o => o.value !== '').map(o => ({
  value: o.value,
  label: o.label,
}));

const SCENE_PRESETS = SCENE_OPTIONS.map(o => ({
  value: o.value,
  label: o.label,
}));

type VaryMode = 'pose' | 'scene' | 'both';

const chipBase = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer border transition-all duration-150 select-none';

export function BatchVariationBuilder({
  clothingUrl,
  clothingBackUrl,
  clothingDetailUrls,
  clothingLength,
  baseModelConfig,
  baseSceneConfig,
  onSubmit,
  isSubmitting,
  disabled,
}: BatchVariationBuilderProps) {
  const [varyMode, setVaryMode] = useState<VaryMode>('pose');
  const [selectedPoses, setSelectedPoses] = useState<string[]>([]);
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);

  const togglePose = (v: string) => {
    setSelectedPoses((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };

  const toggleScene = (v: string) => {
    setSelectedScenes((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };

  const tasks: TaskPayload[] = useMemo(() => {
    const base = {
      clothingUrl,
      clothingBackUrl,
      clothingDetailUrls,
      clothingLength,
    };

    if (varyMode === 'pose') {
      return selectedPoses.map((pose) => ({
        ...base,
        modelConfig: { ...baseModelConfig, pose },
        sceneConfig: baseSceneConfig,
      }));
    }

    if (varyMode === 'scene') {
      return selectedScenes.map((preset) => ({
        ...base,
        modelConfig: baseModelConfig,
        sceneConfig: { ...baseSceneConfig, mode: 'preset' as const, sceneSource: 'preset' as const, preset },
      }));
    }

    // both: cartesian product
    const poses = selectedPoses.length > 0 ? selectedPoses : [''];
    const scenes = selectedScenes.length > 0 ? selectedScenes : [baseSceneConfig.preset];

    const result: TaskPayload[] = [];
    for (const pose of poses) {
      for (const preset of scenes) {
        result.push({
          ...base,
          modelConfig: { ...baseModelConfig, pose: pose || baseModelConfig.pose },
          sceneConfig: { ...baseSceneConfig, mode: 'preset' as const, sceneSource: 'preset' as const, preset },
        });
      }
    }
    return result;
  }, [varyMode, selectedPoses, selectedScenes, clothingUrl, clothingBackUrl, clothingDetailUrls, clothingLength, baseModelConfig, baseSceneConfig]);

  const taskCount = tasks.length;
  const canSubmit = taskCount > 0 && taskCount <= 20 && !disabled && !isSubmitting;

  const handleRandomPick = (count: number) => {
    const shuffled = [...POSE_PRESETS].sort(() => Math.random() - 0.5);
    setSelectedPoses(shuffled.slice(0, count).map((p) => p.value));
  };

  const handleRandomScenePick = (count: number) => {
    const shuffled = [...SCENE_PRESETS].sort(() => Math.random() - 0.5);
    setSelectedScenes(shuffled.slice(0, count).map((s) => s.value));
  };

  return (
    <div className="rounded-2xl border border-[rgba(139,115,85,0.1)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(139,115,85,0.06)]" style={{ background: 'rgba(198,123,92,0.03)' }}>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#c67b5c]" />
          <span className="text-[14px] font-semibold text-[#2d2422]">批量生成</span>
          <span className="text-[11px] text-[#b0a59a] ml-1">同一件服装，多种变体一键出图</span>
        </div>
      </div>

      {/* Vary mode selector */}
      <div className="px-5 py-4 border-b border-[rgba(139,115,85,0.06)]">
        <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase mb-2.5">变化维度</div>
        <div className="flex gap-2">
          {([
            { key: 'pose' as VaryMode, label: '不同姿势', icon: UserCircle, desc: '同场景、换姿势' },
            { key: 'scene' as VaryMode, label: '不同场景', icon: MapPin, desc: '同模特、换场景' },
            { key: 'both' as VaryMode, label: '姿势 × 场景', icon: Shuffle, desc: '全排列组合' },
          ]).map(({ key, label, icon: Icon, desc }) => (
            <button
              key={key}
              type="button"
              className="flex-1 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-200 border cursor-pointer"
              style={varyMode === key ? {
                background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
                color: '#fff',
                borderColor: 'transparent',
                boxShadow: '0 2px 10px rgba(198,123,92,0.2)',
              } : {
                background: 'rgba(139,115,85,0.03)',
                color: '#8b7355',
                borderColor: 'rgba(139,115,85,0.08)',
              }}
              onClick={() => setVaryMode(key)}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </span>
              <div className="text-[10px] mt-0.5 opacity-70">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Pose picker */}
      {(varyMode === 'pose' || varyMode === 'both') && (
        <div className="px-5 py-4 border-b border-[rgba(139,115,85,0.06)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">
              选择姿势
              {selectedPoses.length > 0 && (
                <span className="ml-1.5 text-[#c67b5c] normal-case tracking-normal">
                  ({selectedPoses.length})
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {[3, 5, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="px-2 py-0.5 rounded text-[10px] font-medium text-[#8b7355] bg-[rgba(139,115,85,0.06)] hover:bg-[rgba(139,115,85,0.12)] transition-colors"
                  onClick={() => handleRandomPick(n)}
                >
                  随机{n}个
                </button>
              ))}
              {selectedPoses.length > 0 && (
                <button
                  type="button"
                  className="px-2 py-0.5 rounded text-[10px] font-medium text-[#c47070] bg-[rgba(196,112,112,0.06)] hover:bg-[rgba(196,112,112,0.12)] transition-colors"
                  onClick={() => setSelectedPoses([])}
                >
                  清空
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POSE_PRESETS.map((p) => {
              const sel = selectedPoses.includes(p.value);
              return (
                <button
                  key={p.value}
                  type="button"
                  className={chipBase}
                  style={sel ? {
                    background: 'rgba(198,123,92,0.1)',
                    borderColor: 'rgba(198,123,92,0.3)',
                    color: '#c67b5c',
                  } : {
                    background: 'rgba(139,115,85,0.03)',
                    borderColor: 'rgba(139,115,85,0.08)',
                    color: '#8b7355',
                  }}
                  onClick={() => togglePose(p.value)}
                >
                  {sel && <span className="text-[10px]">✓</span>}
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scene picker */}
      {(varyMode === 'scene' || varyMode === 'both') && (
        <div className="px-5 py-4 border-b border-[rgba(139,115,85,0.06)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-semibold text-[#b0a59a] tracking-[0.1em] uppercase">
              选择场景
              {selectedScenes.length > 0 && (
                <span className="ml-1.5 text-[#c67b5c] normal-case tracking-normal">
                  ({selectedScenes.length})
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              {[3, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="px-2 py-0.5 rounded text-[10px] font-medium text-[#8b7355] bg-[rgba(139,115,85,0.06)] hover:bg-[rgba(139,115,85,0.12)] transition-colors"
                  onClick={() => handleRandomScenePick(n)}
                >
                  随机{n}个
                </button>
              ))}
              {selectedScenes.length > 0 && (
                <button
                  type="button"
                  className="px-2 py-0.5 rounded text-[10px] font-medium text-[#c47070] bg-[rgba(196,112,112,0.06)] hover:bg-[rgba(196,112,112,0.12)] transition-colors"
                  onClick={() => setSelectedScenes([])}
                >
                  清空
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SCENE_PRESETS.map((s) => {
              const sel = selectedScenes.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  className={chipBase}
                  style={sel ? {
                    background: 'rgba(125,155,118,0.1)',
                    borderColor: 'rgba(125,155,118,0.3)',
                    color: '#5a7a53',
                  } : {
                    background: 'rgba(139,115,85,0.03)',
                    borderColor: 'rgba(139,115,85,0.08)',
                    color: '#8b7355',
                  }}
                  onClick={() => toggleScene(s.value)}
                >
                  {sel && <span className="text-[10px]">✓</span>}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview & Submit */}
      <div className="px-5 py-4">
        {/* Combination preview */}
        {taskCount > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-[rgba(139,115,85,0.02)] border border-[rgba(139,115,85,0.06)]">
            <div className="text-[11px] font-semibold text-[#b0a59a] mb-2">
              {varyMode === 'both'
                ? `将生成 ${selectedPoses.length || 1} 个姿势 × ${selectedScenes.length || 1} 个场景 = ${taskCount} 张图`
                : `将生成 ${taskCount} 张图`}
            </div>
            <div className="flex flex-wrap gap-1 max-h-[120px] overflow-y-auto">
              {tasks.slice(0, 20).map((t, i) => {
                const pose = t.modelConfig.pose?.match(/（(.+?)）/)?.[1] || '默认';
                const scene = t.sceneConfig.preset?.match(/（(.+?)）/)?.[1] || '默认';
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-[rgba(139,115,85,0.04)] text-[#8b7355]"
                  >
                    <span className="font-bold text-[#c67b5c]">{i + 1}</span>
                    {varyMode !== 'scene' && pose}
                    {varyMode === 'both' && ' · '}
                    {varyMode !== 'pose' && scene}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {taskCount > 20 && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[rgba(196,112,112,0.06)] text-[11px] text-[#c47070] border border-[rgba(196,112,112,0.1)]">
            超过 20 张上限，请减少选择
          </div>
        )}

        {taskCount === 0 && (
          <div className="mb-3 text-[12px] text-[#c9bfb5] text-center py-4">
            请至少选择一个姿势或场景
          </div>
        )}

        <button
          type="button"
          className="flex flex-col items-center justify-center w-full py-4 px-6 text-white border-none rounded-2xl text-[15px] font-bold cursor-pointer transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundImage: canSubmit
              ? 'linear-gradient(135deg, #c67b5c 0%, #d4a882 50%, #c67b5c 100%)'
              : 'none',
            backgroundColor: canSubmit ? 'transparent' : 'rgba(139,115,85,0.15)',
            backgroundSize: canSubmit ? '200% 100%' : 'auto',
            boxShadow: canSubmit ? '0 4px 24px rgba(198,123,92,0.3)' : 'none',
          }}
          disabled={!canSubmit}
          onClick={() => onSubmit(tasks)}
          onMouseEnter={(e) => {
            if (canSubmit) {
              e.currentTarget.style.backgroundPosition = '100% 0';
              e.currentTarget.style.boxShadow = '0 8px 36px rgba(198,123,92,0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundPosition = '0 0';
            e.currentTarget.style.boxShadow = canSubmit ? '0 4px 24px rgba(198,123,92,0.3)' : 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            {isSubmitting ? '提交中...' : `批量生成 ${taskCount} 张`}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-normal opacity-75 mt-1">
            <Coins className="w-3 h-3" />
            消耗 {taskCount} 积分
          </div>
        </button>
      </div>
    </div>
  );
}
