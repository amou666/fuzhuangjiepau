import type { GenerationTask, ModelConfig, SceneConfig } from '../../types';
import { TaskProgress } from '../common/TaskProgress';

interface StepFusionProps {
  clothingUrl: string;
  modelConfig: ModelConfig;
  sceneConfig: SceneConfig;
  currentTask: GenerationTask | null;
  isPolling: boolean;
  isSubmitting: boolean;
  onGenerate: () => void;
}

export function StepFusion({
  clothingUrl,
  modelConfig,
  sceneConfig,
  currentTask,
  isPolling,
  isSubmitting,
  onGenerate,
}: StepFusionProps) {
  const disabled = !clothingUrl || isSubmitting || isPolling;

  const getGenderLabel = (gender: string) => {
    const map: Record<string, string> = { female: '女性', male: '男性', androgynous: '中性' };
    return map[gender] || gender;
  };

  const getBodyLabel = (body: string) => {
    const map: Record<string, string> = { slim: '修长', athletic: '匀称', curvy: '曲线' };
    return map[body] || body;
  };

  const getPresetLabel = (preset: string) => {
    const map: Record<string, string> = {
      'city street': '城市街道',
      'modern mall': '现代商场',
      'cafe corner': '咖啡厅',
      'natural outdoor': '自然外景',
    };
    return map[preset] || preset;
  };

  return (
    <>
      <div className="workspace-panel-header">
        <h3 className="workspace-panel-title">确认并生成</h3>
        <p className="workspace-panel-subtitle">
          确认服装、模特与场景参数后开始生成高质量街拍图
        </p>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 16px' }}>
          参数摘要
        </h4>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              background: '#f9fafb',
              borderRadius: '8px',
            }}
          >
            <span style={{ fontSize: '12px', color: '#6b7280', width: '80px' }}>服装图</span>
            <span style={{ fontSize: '14px', color: clothingUrl ? '#059669' : '#ef4444', fontWeight: 500 }}>
              {clothingUrl ? '✓ 已上传' : '✗ 未上传'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              background: '#f9fafb',
              borderRadius: '8px',
            }}
          >
            <span style={{ fontSize: '12px', color: '#6b7280', width: '80px' }}>模特</span>
            <span style={{ fontSize: '14px', color: '#374151' }}>
              {modelConfig.mode === 'upload' && modelConfig.imageUrl
                ? '参考图模式'
                : `${getGenderLabel(modelConfig.gender)} · ${getBodyLabel(modelConfig.bodyType)}`}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              background: '#f9fafb',
              borderRadius: '8px',
            }}
          >
            <span style={{ fontSize: '12px', color: '#6b7280', width: '80px' }}>场景</span>
            <span style={{ fontSize: '14px', color: '#374151' }}>
              {sceneConfig.mode === 'upload' && sceneConfig.imageUrl
                ? '参考图模式'
                : getPresetLabel(sceneConfig.preset)}
            </span>
          </div>
        </div>
      </div>

      <button
        className="generate-btn"
        type="button"
        onClick={onGenerate}
        disabled={disabled}
      >
        <div>{isSubmitting || isPolling ? '生成中...' : '立即生成'}</div>
        <div className="generate-btn-cost">消耗 10 积分</div>
      </button>

      {(currentTask || isPolling) && (
        <div style={{ marginTop: '24px' }}>
          <TaskProgress task={currentTask} isPolling={isPolling} />
        </div>
      )}
    </>
  );
}
