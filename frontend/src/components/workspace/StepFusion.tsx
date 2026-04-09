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

  const getCategoryLabel = (category: string) => {
    const map: Record<string, string> = { normal: '普通女孩', supermodel: '时尚超模' };
    return map[category] || category || '时尚超模';
  };

  const getEthnicityLabel = (ethnicity: string) => {
    const map: Record<string, string> = {
      Chinese: '中国人', American: '美国人', British: '英国人', French: '法国人',
      Korean: '韩国人', Japanese: '日本人', Indian: '印度人'
    };
    return map[ethnicity] || ethnicity || '中国人';
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
                ? `参考图模式 · ${getCategoryLabel(modelConfig.category)} · ${modelConfig.age}岁 · ${getEthnicityLabel(modelConfig.ethnicity)}`
                : `${getCategoryLabel(modelConfig.category)} · ${modelConfig.age}岁 · ${getEthnicityLabel(modelConfig.ethnicity)} · ${getGenderLabel(modelConfig.gender)}`}
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
              {sceneConfig.mode === 'replace' && sceneConfig.imageUrl
                ? '替换模式（保留背景和姿势）'
                : sceneConfig.mode === 'upload' && sceneConfig.imageUrl
                  ? '参考图模式'
                  : sceneConfig.preset}
            </span>
          </div>

          {sceneConfig.timeOfDay && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f9fafb',
                borderRadius: '8px',
              }}
            >
              <span style={{ fontSize: '12px', color: '#6b7280', width: '80px' }}>时段</span>
              <span style={{ fontSize: '14px', color: '#374151' }}>
                {sceneConfig.timeOfDay}
              </span>
            </div>
          )}

          {sceneConfig.lighting && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f9fafb',
                borderRadius: '8px',
              }}
            >
              <span style={{ fontSize: '12px', color: '#6b7280', width: '80px' }}>光照</span>
              <span style={{ fontSize: '14px', color: '#374151' }}>
                {sceneConfig.lighting}
              </span>
            </div>
          )}

          {sceneConfig.composition && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f9fafb',
                borderRadius: '8px',
              }}
            >
              <span style={{ fontSize: '12px', color: '#6b7280', width: '80px' }}>构图</span>
              <span style={{ fontSize: '14px', color: '#374151' }}>
                {sceneConfig.composition}
              </span>
            </div>
          )}
        </div>
      </div>

      <button
        className="generate-btn"
        type="button"
        onClick={onGenerate}
        disabled={disabled}
      >
        <div>{isSubmitting || isPolling ? '生成中...' : '立即生成'}</div>
        <div className="generate-btn-cost">消耗 1 积分</div>
      </button>

      {(currentTask || isPolling) && (
        <div style={{ marginTop: '24px' }}>
          <TaskProgress task={currentTask} isPolling={isPolling} />
        </div>
      )}
    </>
  );
}
