'use client'

import { useCallback, useEffect, useMemo, useState } from 'react';
import { workspaceApi } from '@/lib/api/workspace';
import { StepClothing } from '@/lib/components/workspace/StepClothing';
import { StepFusion } from '@/lib/components/workspace/StepFusion';
import { StepModel } from '@/lib/components/workspace/StepModel';
import { StepScene } from '@/lib/components/workspace/StepScene';
import { useAuthStore } from '@/lib/stores/authStore';
import { useNotificationStore } from '@/lib/stores/notificationStore';
import { useTaskStore } from '@/lib/stores/taskStore';
import type { ClothingLength, ModelConfig, SceneConfig } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils/api';

const DRAFT_KEY = 'fashion-ai-workspace-draft';

const steps = [
  { title: '服装图', description: '上传服装主图' },
  { title: '模特配置', description: '设置人物参数' },
  { title: '场景配置', description: '设置真实街拍场景' },
  { title: '融合生成', description: '发起异步任务' },
];

const initialModelConfig: ModelConfig = {
  mode: 'generate',
  category: 'supermodel',
  age: '25',
  ethnicity: 'American',
  gender: 'female',
  skinTone: 'natural',
  bodyType: 'slim',
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
  depthOfField: 'slight',
  aspectRatio: '3:4',
  prompt: '',
};

interface DraftState {
  clothingUrl: string;
  clothingBackUrl: string;
  clothingDetailUrls: string[];
  clothingLength: ClothingLength | undefined;
  modelConfig: ModelConfig;
  sceneConfig: SceneConfig;
  step: number;
}

const loadDraft = (): DraftState | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as DraftState) : null;
  } catch {
    return null;
  }
};

const saveDraft = (draft: DraftState) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
};

const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
};

export default function WorkspacePage() {
  const updateCredits = useAuthStore((state) => state.updateCredits);
  const currentTask = useTaskStore((state) => state.currentTask);
  const isPolling = useTaskStore((state) => state.isPolling);
  const setCurrentTask = useTaskStore((state) => state.setCurrentTask);
  const pollTask = useTaskStore((state) => state.pollTask);
  const addNotification = useNotificationStore((state) => state.add);

  // 自动从草稿恢复，实现页面切换后数据持久化
  const draft = useMemo(() => loadDraft(), []);
  const [step, setStep] = useState(draft?.step ?? 0);
  const [clothingUrl, setClothingUrl] = useState(draft?.clothingUrl ?? '');
  const [clothingBackUrl, setClothingBackUrl] = useState(draft?.clothingBackUrl ?? '');
  const [clothingDetailUrls, setClothingDetailUrls] = useState<string[]>(draft?.clothingDetailUrls ?? []);
  const [clothingLength, setClothingLength] = useState<ClothingLength | undefined>(draft?.clothingLength);
  const [modelConfig, setModelConfig] = useState<ModelConfig>(draft?.modelConfig ?? initialModelConfig);
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>(draft ? {
    ...draft.sceneConfig,
    sceneSource: draft.sceneConfig.sceneSource || (draft.sceneConfig.mode === 'upload' ? 'upload' : 'preset'),
    mode: draft.sceneConfig.mode === 'upload' ? 'preset' : draft.sceneConfig.mode,
  } : initialSceneConfig);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void workspaceApi.getBalance().then(updateCredits).catch(() => undefined);
  }, [updateCredits]);

  // 自动防抖保存草稿（500ms 延迟）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (clothingUrl || step > 0) {
        saveDraft({ clothingUrl, clothingBackUrl, clothingDetailUrls, clothingLength, modelConfig, sceneConfig, step });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [clothingUrl, clothingBackUrl, clothingDetailUrls, clothingLength, modelConfig, sceneConfig, step]);

  const handleRestoreDraft = () => {
    // 已自动恢复，无需手动操作
  };

  const handleDiscardDraft = () => {
    clearDraft();
  };

  const handleGenerate = useCallback(async () => {
    setSubmitting(true);
    setError('');

    try {
      const task = await workspaceApi.createTask({ clothingUrl, clothingBackUrl, clothingDetailUrls, clothingLength, modelConfig, sceneConfig });
      setCurrentTask(task);
      updateCredits(await workspaceApi.getBalance());

      // 清除草稿，任务已提交
      clearDraft();

      // 通知用户可以离开，后台在处理
      addNotification({ type: 'info', message: '任务已提交，处理完成后会自动通知你，你可以先去干别的！' });

      // 后台轮询（SSE 优先，HTTP 兜底），不阻塞 UI
      void pollTask(task.id).then(() => {
        // 轮询结束后也刷新余额（兜底 SSE 通知）
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
      return <StepModel value={modelConfig} onChange={setModelConfig} />;
    }

    if (step === 2) {
      return <StepScene value={sceneConfig} onChange={setSceneConfig} />;
    }

    return (
      <StepFusion
        clothingUrl={clothingUrl}
        clothingBackUrl={clothingBackUrl}
        clothingDetailUrls={clothingDetailUrls}
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
    if (!clothingLength) return '未选择';
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
    const genderMap: Record<string, string> = { female: '女性', male: '男性', androgynous: '中性' };
    const bodyMap: Record<string, string> = { slim: '修长', athletic: '匀称', curvy: '曲线' };
    const category = categoryMap[modelConfig.category] || '时尚超模';
    const ethnicity = ethnicityMap[modelConfig.ethnicity] || '中国人';
    return `${category} · ${modelConfig.age}岁 · ${ethnicity}`;
  };

  const getSceneDisplay = () => {
    // 替换模式特殊显示
    if (sceneConfig.mode === 'replace') {
      return '替换模式 · 保留参考图背景和姿势';
    }
    // 上传场景图
    if (sceneConfig.sceneSource === 'upload') {
      return '上传场景图';
    }
    // 场景预设已包含中文翻译，组合其他预设信息
    const parts = [sceneConfig.preset];
    if (sceneConfig.timeOfDay) parts.push(sceneConfig.timeOfDay);
    if (sceneConfig.lighting) parts.push(sceneConfig.lighting);
    if (sceneConfig.composition) parts.push(sceneConfig.composition);
    return parts.join(' · ');
  };

  return (
    <div className="workspace-container">
      <div className="workspace-header">
        <h1>生图工作台</h1>
        <p>按照 4 个步骤完成配置，系统将异步生成带有真实街拍感的结果图。</p>
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <div className="workspace-stepper">
        {steps.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={`workspace-step ${step === index ? 'workspace-step-active' : ''}`}
            onClick={() => setStep(index)}
          >
            <span className="workspace-step-number">{index + 1}</span>
            <span className="workspace-step-title">{item.title}</span>
            <span className="workspace-step-desc">{item.description}</span>
          </button>
        ))}
      </div>

      <div className="workspace-content">
        <div className="workspace-panel">
          {currentStepContent}

          <div className="workspace-actions">
            <button
              className="btn-secondary"
              type="button"
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(value - 1, 0))}
            >
              上一步
            </button>
            {step < steps.length - 1 ? (
              <button
                className="btn"
                type="button"
                onClick={() => setStep((value) => Math.min(value + 1, steps.length - 1))}
              >
                下一步
              </button>
            ) : null}
          </div>
        </div>

        <aside className="workspace-preview">
          <h2 className="workspace-preview-title">实时预览</h2>
          <p className="workspace-preview-subtitle">左侧配置会实时反映到这里</p>

          <div className="workspace-preview-section">
            <div className="workspace-preview-label">服装图</div>
            {clothingUrl ? (
              <div className="workspace-preview-image">
                <img src={clothingUrl} alt="服装图预览" />
              </div>
            ) : (
              <div className="workspace-preview-placeholder">尚未上传</div>
            )}
            {clothingBackUrl && (
              <>
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>背面图</div>
                <div className="workspace-preview-image" style={{ marginTop: '4px' }}>
                  <img src={clothingBackUrl} alt="服装背面图预览" />
                </div>
              </>
            )}
            {clothingDetailUrls.filter(Boolean).length > 0 && (
              <>
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280' }}>细节图</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {clothingDetailUrls.filter(Boolean).map((url, i) => (
                    <div key={i} style={{ width: '60px', height: '60px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                      <img src={url} alt={`细节图${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#aaa' }}>衣长：{getClothingLengthDisplay()}</div>
          </div>

          <div className="workspace-preview-section">
            <div className="workspace-preview-label">模特配置</div>
            <div className="workspace-preview-info">
              <p className="workspace-preview-info-item">{getModelDisplay()}</p>
              <p className="workspace-preview-info-detail">
                {modelConfig.pose} · {modelConfig.expression}
              </p>
            </div>
          </div>

          <div className="workspace-preview-section">
            <div className="workspace-preview-label">场景配置</div>
            <div className="workspace-preview-info">
              <p className="workspace-preview-info-item">{getSceneDisplay()}</p>
              <p className="workspace-preview-info-detail">
                {sceneConfig.prompt || '未补充额外提示词'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
