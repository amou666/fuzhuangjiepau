import { useCallback, useEffect, useMemo, useState } from 'react';
import { workspaceApi } from '../../api/workspace';
import { StepClothing } from '../../components/workspace/StepClothing';
import { StepFusion } from '../../components/workspace/StepFusion';
import { StepModel } from '../../components/workspace/StepModel';
import { StepScene } from '../../components/workspace/StepScene';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useTaskStore } from '../../stores/taskStore';
import type { ModelConfig, SceneConfig } from '../../types';
import { getErrorMessage } from '../../utils/api';

const DRAFT_KEY = 'fashion-ai-workspace-draft';

const steps = [
  { title: '服装图', description: '上传服装主图' },
  { title: '模特配置', description: '设置人物参数' },
  { title: '场景配置', description: '设置真实街拍场景' },
  { title: '融合生成', description: '发起异步任务' },
];

const initialModelConfig: ModelConfig = {
  mode: 'generate',
  gender: 'female',
  skinTone: 'natural',
  bodyType: 'slim',
  pose: 'walking confidently（自信地行走）',
  expression: 'natural smile（自然微笑）',
};

const initialSceneConfig: SceneConfig = {
  mode: 'preset',
  preset: 'city street（城市街道）',
  prompt: 'soft evening light, candid atmosphere',
};

interface DraftState {
  clothingUrl: string;
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

  // 尝试从草稿恢复
  const draft = useMemo(() => loadDraft(), []);
  const [draftRestorePrompt, setDraftRestorePrompt] = useState(!!draft);

  const [step, setStep] = useState(0);
  const [clothingUrl, setClothingUrl] = useState('');
  const [modelConfig, setModelConfig] = useState<ModelConfig>(initialModelConfig);
  const [sceneConfig, setSceneConfig] = useState<SceneConfig>(initialSceneConfig);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void workspaceApi.getBalance().then(updateCredits).catch(() => undefined);
  }, [updateCredits]);

  // 自动防抖保存草稿（500ms 延迟）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (clothingUrl || step > 0) {
        saveDraft({ clothingUrl, modelConfig, sceneConfig, step });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [clothingUrl, modelConfig, sceneConfig, step]);

  const handleRestoreDraft = () => {
    if (draft) {
      setClothingUrl(draft.clothingUrl);
      setModelConfig(draft.modelConfig);
      setSceneConfig(draft.sceneConfig);
      setStep(draft.step);
    }
    setDraftRestorePrompt(false);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setDraftRestorePrompt(false);
  };

  const handleGenerate = useCallback(async () => {
    setSubmitting(true);
    setError('');

    try {
      const task = await workspaceApi.createTask({ clothingUrl, modelConfig, sceneConfig });
      setCurrentTask(task);
      updateCredits(await workspaceApi.getBalance());

      // 清除草稿，任务已提交
      clearDraft();

      // 通知用户可以离开，后台在处理
      addNotification({ type: 'info', message: '任务已提交，处理完成后会自动通知你，你可以先去干别的！' });

      // 后台轮询（SSE 优先，HTTP 兜底），不阻塞 UI
      void pollTask(task.id).then((result) => {
        if (result) updateCredits(result.creditCost ? 0 : 0); // 余额已由 SSE 回调刷新
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError, '提交任务失败'));
    } finally {
      setSubmitting(false);
    }
  }, [clothingUrl, modelConfig, pollTask, sceneConfig, setCurrentTask, updateCredits, addNotification]);

  const currentStepContent = useMemo(() => {
    if (step === 0) {
      return <StepClothing clothingUrl={clothingUrl} onChange={setClothingUrl} />;
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
  }, [clothingUrl, currentTask, handleGenerate, isPolling, modelConfig, sceneConfig, step, submitting]);

  const getModelDisplay = () => {
    const genderMap: Record<string, string> = { female: '女性', male: '男性', androgynous: '中性' };
    const bodyMap: Record<string, string> = { slim: '修长', athletic: '匀称', curvy: '曲线' };
    return `${genderMap[modelConfig.gender] || modelConfig.gender} · ${bodyMap[modelConfig.bodyType] || modelConfig.bodyType}`;
  };

  const getSceneDisplay = () => {
    // 场景预设已包含中文翻译，直接返回
    return sceneConfig.preset;
  };

  return (
    <div className="workspace-container">
      <div className="workspace-header">
        <h1>生图工作台</h1>
        <p>按照 4 个步骤完成配置，系统将异步生成带有真实街拍感的结果图。</p>
      </div>

      {/* 草稿恢复提示 */}
      {draftRestorePrompt && (
        <div className="draft-restore-banner">
          <span>检测到上次未完成的配置，是否恢复？</span>
          <div className="draft-restore-actions">
            <button className="btn" type="button" onClick={handleRestoreDraft}>
              恢复配置
            </button>
            <button className="btn-secondary" type="button" onClick={handleDiscardDraft}>
              丢弃
            </button>
          </div>
        </div>
      )}

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
