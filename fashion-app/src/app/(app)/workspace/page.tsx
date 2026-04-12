'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';

import { workspaceApi } from '@/lib/api/workspace';
import { StepClothing } from '@/lib/components/workspace/StepClothing';
import { StepFusion } from '@/lib/components/workspace/StepFusion';
import { StepModel } from '@/lib/components/workspace/StepModel';
import { StepScene } from '@/lib/components/workspace/StepScene';
import { useSwipe } from '@/lib/hooks/useSwipe';
import { useAuthStore } from '@/lib/stores/authStore';
import { useDraftStore } from '@/lib/stores/draftStore';
import { useNotificationStore } from '@/lib/stores/notificationStore';
import { useTaskStore } from '@/lib/stores/taskStore';
import type { ClothingLength, ModelConfig, SceneConfig } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils/api';
import { Check, Shirt, UserCircle, MapPin, Sparkles, Sun, Camera, Maximize2 } from 'lucide-react';

const steps = [
  { title: '服装', subtitle: '上传服装', icon: Shirt },
  { title: '场景', subtitle: '街拍场景', icon: MapPin },
  { title: '模特', subtitle: '人物参数', icon: UserCircle },
  { title: '生成', subtitle: '融合出图', icon: Sparkles },
];

const initialModelConfig: ModelConfig = {
  mode: 'generate',
  category: 'supermodel',
  age: '20',
  ethnicity: 'American',
  gender: 'female',
  skinTone: 'fair',
  bodyType: 'slim',
  faceFeature: '',
  pose: '',
  expression: '',
};

const initialSceneConfig: SceneConfig = {
  mode: 'preset',
  sceneSource: 'preset',
  preset: 'city street（城市街道）',
  timeOfDay: '',
  lighting: '',
  composition: '',
  exposureMode: 'natural',
  prompt: '',
};

export default function WorkspacePage() {
  const updateCredits = useAuthStore((state) => state.updateCredits);
  const currentTask = useTaskStore((state) => state.currentTask);
  const isPolling = useTaskStore((state) => state.isPolling);
  const setCurrentTask = useTaskStore((state) => state.setCurrentTask);
  const pollTask = useTaskStore((state) => state.pollTask);
  const addNotification = useNotificationStore((state) => state.add);

  const workspaceDraft = useDraftStore((state) => state.workspaceDraft);
  const setWorkspaceDraft = useDraftStore((state) => state.setWorkspaceDraft);
  const clearWorkspaceDraft = useDraftStore((state) => state.clearWorkspaceDraft);

  const draft = useMemo(() => workspaceDraft, [workspaceDraft]);
  const [step, setStep] = useState(draft?.step ?? 0);
  const [clothingUrl, setClothingUrl] = useState(draft?.clothingUrl ?? '');
  const [clothingBackUrl, setClothingBackUrl] = useState(draft?.clothingBackUrl ?? '');
  const [clothingDetailUrls, setClothingDetailUrls] = useState<string[]>(draft?.clothingDetailUrls ?? []);
  const [clothingLength, setClothingLength] = useState<ClothingLength | undefined>(draft?.clothingLength);
  const [modelConfig, setModelConfig] = useState<ModelConfig>(draft?.modelConfig ?? initialModelConfig);
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>(draft ? {
    ...draft.sceneConfig,
  } : initialSceneConfig);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const stepSectionRef = useRef<HTMLDivElement>(null);
  const shouldScrollToStepRef = useRef(false);

  const updateStep = useCallback((nextStepOrUpdater: SetStateAction<number>) => {
    setStep((currentStep) => {
      const nextStep = typeof nextStepOrUpdater === 'function'
        ? (nextStepOrUpdater as (value: number) => number)(currentStep)
        : nextStepOrUpdater;

      if (nextStep !== currentStep) {
        shouldScrollToStepRef.current = true;
      }

      return nextStep;
    });
  }, []);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => updateStep((v) => Math.min(v + 1, steps.length - 1)),
    onSwipeRight: () => updateStep((v) => Math.max(v - 1, 0)),
  });


  const stateRef = useRef({ clothingUrl, clothingBackUrl, clothingDetailUrls, clothingLength, modelConfig, sceneConfig, step });
  stateRef.current = { clothingUrl, clothingBackUrl, clothingDetailUrls, clothingLength, modelConfig, sceneConfig, step };

  useEffect(() => {
    void workspaceApi.getBalance().then(updateCredits).catch(() => undefined);
  }, [updateCredits]);

  useEffect(() => {
    if (!shouldScrollToStepRef.current) {
      return;
    }

    shouldScrollToStepRef.current = false;

    const stepSection = stepSectionRef.current;
    if (!stepSection) {
      return;
    }

    const topOffset = window.innerWidth < 768 ? 72 : 24;
    const targetTop = stepSection.getBoundingClientRect().top + window.scrollY - topOffset;

    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: 'smooth',
    });
  }, [step]);

  useEffect(() => {

    const timer = setTimeout(() => {
      const s = stateRef.current;
      if (s.clothingUrl || s.step > 0) {
        setWorkspaceDraft(s);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      const s = stateRef.current;
      if (s.clothingUrl || s.step > 0) {
        setWorkspaceDraft(s);
      }
    };
  }, [clothingUrl, clothingBackUrl, clothingDetailUrls, clothingLength, modelConfig, sceneConfig, step, setWorkspaceDraft]);

  const handleGenerate = useCallback(async (overridePayload?: Record<string, unknown>) => {
    setSubmitting(true);
    setError('');

    try {
      const defaultPayload = { clothingUrl, clothingBackUrl, clothingDetailUrls, clothingLength, modelConfig, sceneConfig };
      const finalPayload = overridePayload ? { ...defaultPayload, ...overridePayload } : defaultPayload;
      const task = await workspaceApi.createTask(finalPayload);
      setCurrentTask(task);
      updateCredits(await workspaceApi.getBalance());
      clearWorkspaceDraft();
      addNotification({ type: 'info', message: '任务已提交，处理完成后会自动通知你，你可以先去干别的！' });
      void pollTask(task.id).then(() => {
        void workspaceApi.getBalance().then(updateCredits).catch(() => undefined);
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError, '提交任务失败'));
    } finally {
      setSubmitting(false);
    }
  }, [clothingUrl, clothingBackUrl, clothingDetailUrls, clothingLength, modelConfig, pollTask, sceneConfig, setCurrentTask, updateCredits, addNotification]);

  const currentStepContent = useMemo(() => {
    if (step === 0) {
      return <StepClothing clothingUrl={clothingUrl} clothingBackUrl={clothingBackUrl} clothingDetailUrls={clothingDetailUrls} clothingLength={clothingLength} onChange={setClothingUrl} onBackChange={setClothingBackUrl} onDetailChange={setClothingDetailUrls} onClothingLengthChange={setClothingLength} />;
    }

    if (step === 1) {
      return <StepScene value={sceneConfig} onChange={setSceneConfig} />;
    }

    if (step === 2) {
      return <StepModel value={modelConfig} onChange={setModelConfig} sceneMode={sceneConfig.mode} />;
    }

    return (
      <StepFusion
        clothingUrl={clothingUrl}
        clothingBackUrl={clothingBackUrl}
        clothingDetailUrls={clothingDetailUrls}
        clothingLength={clothingLength}
        modelConfig={modelConfig}
        sceneConfig={sceneConfig}
        currentTask={currentTask}
        isPolling={isPolling}
        isSubmitting={submitting}
        onGenerate={() => {
          void handleGenerate();
        }}
      />
    );
  }, [clothingUrl, clothingBackUrl, clothingDetailUrls, currentTask, handleGenerate, isPolling, modelConfig, sceneConfig, step, submitting]);

  const getClothingLengthDisplay = () => {
    if (!clothingLength) return '--';
    const map: Record<ClothingLength, string> = {
      cropped: '短款',
      standard: '标准',
      'hip-length': '盖臀',
      'knee-length': '膝盖长',
      'ankle-length': '脚踝长',
    };
    return map[clothingLength];
  };

  const getModelDisplay = () => {
    const categoryMap: Record<string, string> = { normal: '普通女孩', supermodel: '时尚超模', kardashian: '卡戴珊风格' };
    const ethnicityMap: Record<string, string> = {
      Chinese: '中国人', American: '美国人', British: '英国人', French: '法国人',
      Korean: '韩国人', Japanese: '日本人', Indian: '印度人'
    };
    const category = categoryMap[modelConfig.category] || '时尚超模';
    const ethnicity = ethnicityMap[modelConfig.ethnicity] || '中国人';
    return `${category} / ${modelConfig.age}岁 / ${ethnicity}`;
  };

  const getSceneDisplay = () => {
    if (sceneConfig.mode === 'replace') {
      return '替换模式';
    }
    if (sceneConfig.sceneSource === 'upload') {
      return '上传场景图';
    }
    return sceneConfig.preset;
  };

  const getExposureModeDisplay = () => {
    const mode = sceneConfig.exposureMode ?? 'natural';
    if (mode === 'bright') return '偏亮';
    if (mode === 'dark') return '偏暗';
    return '自然';
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header — Editorial Style */}
      <div className="hidden md:flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#2d2422]">生图工作台</h1>
          <p className="text-[13px] text-[#9b8e82] mt-1 tracking-wide">四步完成配置，生成真实街拍感大片</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[11px] text-[#b0a59a] tracking-widest uppercase">
          <span>步骤</span>
          <span className="text-[#c67b5c] font-bold text-sm">{step + 1}</span>
          <span>/ 4</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#fef2f0] text-[#c47070] px-5 py-3.5 rounded-2xl text-sm font-medium border border-[#f0d5d0]">
          {error}
        </div>
      )}

      {/* Stepper — Minimal Dots + Labels */}
      <div ref={stepSectionRef} className="flex items-center gap-0">

        {steps.map((item, index) => {
          const Icon = item.icon;
          const isActive = step === index;
          const isDone = step > index;
          return (
            <button
              key={item.title}
              type="button"
              className="flex-1 group"
              onClick={() => updateStep(index)}
            >

              <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300"
                style={{
                  background: isActive ? 'rgba(198,123,92,0.08)' : 'transparent',
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 flex-shrink-0"
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)'
                      : isDone
                        ? 'rgba(125,155,118,0.15)'
                        : 'rgba(139,115,85,0.06)',
                    color: isActive ? '#fff' : isDone ? '#7d9b76' : '#b0a59a',
                  }}
                >
                  {isDone && !isActive ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="#7d9b76" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 text-left">
                  <div className={`text-[13px] font-semibold transition-colors duration-300 ${isActive ? 'text-[#2d2422]' : 'text-[#b0a59a]'}`}>
                    {item.title}
                  </div>
                  <div className={`hidden md:block text-[11px] transition-colors duration-300 ${isActive ? 'text-[#c67b5c]' : 'text-[#c9bfb5]'}`}>
                    {item.subtitle}
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              {index < steps.length - 1 && (
                <div className="h-[2px] mx-4 -mt-1 rounded-full overflow-hidden bg-[rgba(139,115,85,0.06)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: isDone ? '100%' : '0%',
                      background: 'linear-gradient(90deg, #c67b5c, #d4a882)',
                    }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Content + Preview */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6">
        {/* Main Content Area */}
        <div className="fashion-card rounded-[20px] p-7 md:p-7 max-md:p-5" {...swipeHandlers}>

          {currentStepContent}

          <div className="flex gap-3 mt-8 pt-6 border-t border-[rgba(139,115,85,0.08)]">
            <button
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-[13px] font-medium rounded-xl transition-all duration-200 disabled:opacity-40"
              style={{
                background: 'rgba(139,115,85,0.05)',
                color: '#8b7355',
                border: '1px solid rgba(139,115,85,0.1)',
              }}
              type="button"
              disabled={step === 0}
              onClick={() => updateStep((value) => Math.max(value - 1, 0))}

              onMouseEnter={(e) => {
                if (step !== 0) {
                  e.currentTarget.style.background = 'rgba(139,115,85,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(139,115,85,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(139,115,85,0.05)';
                e.currentTarget.style.borderColor = 'rgba(139,115,85,0.1)';
              }}
            >
              上一步
            </button>
            {step < steps.length - 1 && (
              <button
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-[13px] font-semibold rounded-xl text-white transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)',
                  boxShadow: '0 2px 12px rgba(198,123,92,0.25)',
                }}
                type="button"
                onClick={() => updateStep((value) => Math.min(value + 1, steps.length - 1))}

                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(198,123,92,0.4)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(198,123,92,0.25)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                下一步
              </button>
            )}
          </div>
        </div>

        {/* Preview Sidebar — Editorial Layout */}
        <aside className="hidden md:block fashion-card rounded-[20px] p-6 sticky top-6 max-h-[calc(100vh-48px)] overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-bold text-[#2d2422] tracking-tight">预览</h2>
            <span className="text-[10px] text-[#b0a59a] tracking-widest uppercase">实时预览</span>
          </div>

          {/* 汇总 */}
          <div className="mb-5 pb-5 border-b border-[rgba(139,115,85,0.06)]">
            <div className="text-[10px] font-semibold text-[#b0a59a] tracking-[0.15em] uppercase mb-3">汇总</div>
            <div className="grid gap-1.5">
              {[
                { icon: <Shirt className="w-3.5 h-3.5" />, label: '服装', content: clothingUrl ? `正面图${clothingBackUrl ? ' + 背面图' : ''}${clothingDetailUrls.filter(Boolean).length ? ` + ${clothingDetailUrls.filter(Boolean).length}张细节图` : ''}` : '未上传', ok: !!clothingUrl },
                { icon: <UserCircle className="w-3.5 h-3.5" />, label: '模特', content: getModelDisplay(), ok: true },
                { icon: <MapPin className="w-3.5 h-3.5" />, label: '场景', content: getSceneDisplay(), ok: true },
                ...(sceneConfig.timeOfDay ? [{ icon: <Sun className="w-3.5 h-3.5" />, label: '时段', content: sceneConfig.timeOfDay, ok: true }] : []),
                ...(sceneConfig.lighting ? [{ icon: <Maximize2 className="w-3.5 h-3.5" />, label: '光照', content: sceneConfig.lighting, ok: true }] : []),
                { icon: <Sun className="w-3.5 h-3.5" />, label: '曝光', content: getExposureModeDisplay(), ok: true },
                ...(sceneConfig.composition ? [{ icon: <Camera className="w-3.5 h-3.5" />, label: '构图', content: sceneConfig.composition, ok: true }] : []),
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: item.ok ? 'rgba(139,115,85,0.03)' : 'rgba(196,112,112,0.04)' }}>
                  <span style={{ color: item.ok ? '#b0a59a' : '#c47070' }}>{item.icon}</span>
                  <span className="text-[10px] font-semibold text-[#b0a59a] tracking-wider uppercase w-10 flex-shrink-0">{item.label}</span>
                  <span className="text-[11px] font-medium truncate" style={{ color: item.ok ? '#2d2422' : '#c47070' }}>
                    {item.ok && <span className="text-[#7d9b76] mr-1"><Check className="w-3 h-3 inline" /></span>}
                    {item.content}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Clothing */}
          <div className="mb-6">
            <div className="text-[10px] font-semibold text-[#b0a59a] tracking-[0.15em] uppercase mb-3">服装</div>
            {clothingUrl ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl overflow-hidden border border-[rgba(139,115,85,0.08)] aspect-[3/4]">
                  <img src={clothingUrl} alt="正面" className="w-full h-full object-cover" />
                </div>
                {clothingBackUrl ? (
                  <div className="rounded-xl overflow-hidden border border-[rgba(139,115,85,0.08)] aspect-[3/4]">
                    <img src={clothingBackUrl} alt="背面" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[rgba(139,115,85,0.12)] aspect-[3/4] flex items-center justify-center text-[11px] text-[#c9bfb5]">
                    无背面图
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-[12px] text-[#c9bfb5] rounded-xl border border-dashed border-[rgba(139,115,85,0.1)]">
                尚未上传服装图
              </div>
            )}
            {clothingDetailUrls.filter(Boolean).length > 0 && (
              <div className="flex gap-1.5 mt-2">
                {clothingDetailUrls.filter(Boolean).map((url, i) => (
                  <div key={i} className="w-12 h-12 rounded-lg overflow-hidden border border-[rgba(139,115,85,0.08)]">
                    <img src={url} alt={`细节${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 text-[11px] text-[#b0a59a]">衣长: {getClothingLengthDisplay()}</div>
          </div>

          {/* Scene */}
          <div className="mb-6 pb-6 border-b border-[rgba(139,115,85,0.06)]">
            <div className="text-[10px] font-semibold text-[#b0a59a] tracking-[0.15em] uppercase mb-3">场景</div>
            <div className="bg-[rgba(139,115,85,0.03)] rounded-xl p-3.5">
              <p className="text-[13px] font-semibold text-[#2d2422] m-0">{getSceneDisplay()}</p>
              <p className="text-[11px] text-[#9b8e82] mt-1.5 m-0">
                {sceneConfig.prompt || '无补充提示词'}
              </p>
            </div>
          </div>

          {/* Model */}
          <div>
            <div className="text-[10px] font-semibold text-[#b0a59a] tracking-[0.15em] uppercase mb-3">模特</div>
            <div className="bg-[rgba(139,115,85,0.03)] rounded-xl p-3.5">
              <p className="text-[13px] font-semibold text-[#2d2422] m-0">{getModelDisplay()}</p>
              <p className="text-[11px] text-[#9b8e82] mt-1.5 m-0">
                {sceneConfig.mode === 'replace' ? '由参考图决定' : `${modelConfig.pose || '自由姿势'} / ${modelConfig.expression || '自由表情'}`}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
