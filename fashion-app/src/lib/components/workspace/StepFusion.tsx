import type { GenerationTask, ModelConfig, SceneConfig, ClothingLength, TaskPayload } from '@/lib/types';
import { mergeModelConfigWithCastingNarrative } from '@/lib/model-narrative';
import { categoryOptions, ethnicityOptions } from '@/lib/model-options';
import { TaskProgress } from '@/lib/components/common/TaskProgress';
import { BatchVariationBuilder } from './BatchVariationBuilder';
import { BatchProgress } from './BatchProgress';
import { Copy, CheckCheck, RotateCcw, Layers, ChevronDown, Shirt, UserCircle, MapPin, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface StepFusionProps {
  clothingUrl: string;
  clothingBackUrl?: string;
  clothingDetailUrls?: string[];
  clothingLength?: ClothingLength;
  modelConfig: ModelConfig;
  sceneConfig: SceneConfig;
  currentTask: GenerationTask | null;
  isPolling: boolean;
  isSubmitting: boolean;
  onGenerate: (overridePayload?: Record<string, unknown>) => void;
  batchTasks: GenerationTask[];
  isBatchPolling: boolean;
  isBatchSubmitting: boolean;
  onBatchGenerate: (tasks: TaskPayload[]) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* clipboard not available */ });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[#8b7355] bg-[rgba(139,115,85,0.06)] hover:bg-[rgba(139,115,85,0.12)] transition-colors"
    >
      {copied ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? '已复制' : '复制'}
    </button>
  );
}

export function StepFusion({
  clothingUrl,
  clothingBackUrl,
  clothingDetailUrls,
  clothingLength,
  modelConfig,
  sceneConfig,
  currentTask,
  isPolling,
  isSubmitting,
  onGenerate,
  batchTasks,
  isBatchPolling,
  isBatchSubmitting,
  onBatchGenerate,
}: StepFusionProps) {
  const disabled = !clothingUrl || isSubmitting || isPolling || isBatchSubmitting || isBatchPolling;
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [showJson, setShowJson] = useState(false);
  const [editedJson, setEditedJson] = useState('');
  const [jsonError, setJsonError] = useState('');

  const getClothingLengthLabel = (cl?: ClothingLength) => {
    if (!cl) return '自动';
    const map: Record<ClothingLength, string> = {
      cropped: '短款', standard: '标准', 'hip-length': '盖臀', 'knee-length': '膝盖长', 'ankle-length': '脚踝长',
    };
    return map[cl];
  };

  const getCategoryLabel = () => {
    return categoryOptions.find(o => o.value === modelConfig.category)?.label || modelConfig.category;
  };

  const getEthnicityLabel = () => {
    return ethnicityOptions.find(o => o.value === modelConfig.ethnicity)?.label || modelConfig.ethnicity;
  };

  const getSceneLabel = () => {
    if (sceneConfig.mode === 'replace') return '替换模式';
    if (sceneConfig.sceneSource === 'upload') return '上传场景图';
    return sceneConfig.preset?.match(/（(.+?)）/)?.[1] || sceneConfig.preset?.split('（')[0] || sceneConfig.preset;
  };

  const payload = {
    clothingUrl,
    ...(clothingBackUrl ? { clothingBackUrl } : {}),
    ...(clothingDetailUrls?.filter(Boolean).length ? { clothingDetailUrls: clothingDetailUrls.filter(Boolean) } : {}),
    ...(clothingLength ? { clothingLength } : {}),
    modelConfig: mergeModelConfigWithCastingNarrative(modelConfig, sceneConfig.mode),
    sceneConfig,
  };

  const payloadRef = useRef(payload);
  const payloadJsonStr = JSON.stringify(payload, null, 2);

  useEffect(() => {
    setEditedJson(JSON.stringify(payload, null, 2));
    setJsonError('');
    payloadRef.current = payload;
  }, [payloadJsonStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const isJsonModified = editedJson !== JSON.stringify(payloadRef.current, null, 2);

  const handleJsonChange = (value: string) => {
    setEditedJson(value);
    try {
      JSON.parse(value);
      setJsonError('');
    } catch {
      setJsonError('JSON 格式错误');
    }
  };

  const handleResetJson = () => {
    setEditedJson(JSON.stringify(payloadRef.current, null, 2));
    setJsonError('');
  };

  const imageCount = [clothingUrl, clothingBackUrl, ...(clothingDetailUrls ?? [])].filter(Boolean).length
    + (modelConfig.mode === 'upload' && modelConfig.imageUrl ? 1 : 0)
    + (sceneConfig.imageUrl ? 1 : 0);

  return (
    <>
      <div className="mb-6">
        <h3 className="text-[17px] font-bold text-[#2d2422] tracking-tight">确认并生成</h3>
        <p className="hidden md:block text-[12px] text-[#9b8e82] mt-1 tracking-wide">
          检查配置无误后点击生成
        </p>
      </div>

      {/* Mode Toggle: Single vs Batch */}
      <div className="mb-6">
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 border cursor-pointer"
            style={mode === 'single' ? {
              background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
              color: '#fff',
              borderColor: 'transparent',
              boxShadow: '0 2px 10px rgba(198,123,92,0.2)',
            } : {
              background: 'rgba(139,115,85,0.03)',
              color: '#8b7355',
              borderColor: 'rgba(139,115,85,0.08)',
            }}
            onClick={() => setMode('single')}
          >
            单张生成
          </button>
          <button
            type="button"
            className="flex-1 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 border cursor-pointer"
            style={mode === 'batch' ? {
              background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
              color: '#fff',
              borderColor: 'transparent',
              boxShadow: '0 2px 10px rgba(198,123,92,0.2)',
            } : {
              background: 'rgba(139,115,85,0.03)',
              color: '#8b7355',
              borderColor: 'rgba(139,115,85,0.08)',
            }}
            onClick={() => setMode('batch')}
          >
            <span className="inline-flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> 批量生成</span>
          </button>
        </div>
      </div>

      {/* Batch Mode */}
      {mode === 'batch' && (
        <>
          <BatchVariationBuilder
            clothingUrl={clothingUrl}
            clothingBackUrl={clothingBackUrl}
            clothingDetailUrls={clothingDetailUrls}
            clothingLength={clothingLength}
            baseModelConfig={modelConfig}
            baseSceneConfig={sceneConfig}
            onSubmit={onBatchGenerate}
            isSubmitting={isBatchSubmitting}
            disabled={!clothingUrl || isBatchPolling}
          />

          {(batchTasks.length > 0 || isBatchPolling) && (
            <div className="mt-6">
              <BatchProgress tasks={batchTasks} isPolling={isBatchPolling} />
            </div>
          )}
        </>
      )}

      {/* Single Mode - Visual Summary */}
      {mode === 'single' && <>
      <div className="mb-6">
        <div className="rounded-2xl border border-[rgba(139,115,85,0.08)] overflow-hidden">
          {/* Visual Summary Cards */}
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Clothing */}
            <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[rgba(139,115,85,0.02)]">
              {clothingUrl ? (
                <div className="w-12 h-16 rounded-lg overflow-hidden border border-[rgba(139,115,85,0.1)]">
                  <img src={clothingUrl} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-16 rounded-lg flex items-center justify-center bg-[rgba(196,112,112,0.06)]">
                  <Shirt className="w-5 h-5 text-[#c47070]" />
                </div>
              )}
              <div className="text-center">
                <div className="text-[10px] font-semibold text-[#b0a59a] uppercase">服装</div>
                <div className="text-[11px] font-medium text-[#2d2422]">
                  {clothingUrl ? `${imageCount - (modelConfig.mode === 'upload' && modelConfig.imageUrl ? 1 : 0) - (sceneConfig.imageUrl ? 1 : 0)}张` : '未上传'}
                </div>
                <div className="text-[10px] text-[#c9bfb5]">{getClothingLengthLabel(clothingLength)}</div>
              </div>
            </div>

            {/* Model */}
            <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[rgba(139,115,85,0.02)]">
              <div className="w-12 h-16 rounded-lg flex items-center justify-center" style={{ background: 'rgba(198,123,92,0.06)' }}>
                <UserCircle className="w-5 h-5 text-[#c67b5c]" />
              </div>
              <div className="text-center">
                <div className="text-[10px] font-semibold text-[#b0a59a] uppercase">模特</div>
                <div className="text-[11px] font-medium text-[#2d2422]">{getCategoryLabel()}</div>
                <div className="text-[10px] text-[#c9bfb5]">{modelConfig.age}岁 · {getEthnicityLabel()}</div>
              </div>
            </div>

            {/* Scene */}
            <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[rgba(139,115,85,0.02)]">
              <div className="w-12 h-16 rounded-lg flex items-center justify-center" style={{ background: 'rgba(125,155,118,0.08)' }}>
                <MapPin className="w-5 h-5 text-[#7d9b76]" />
              </div>
              <div className="text-center">
                <div className="text-[10px] font-semibold text-[#b0a59a] uppercase">场景</div>
                <div className="text-[11px] font-medium text-[#2d2422]">{getSceneLabel()}</div>
                <div className="text-[10px] text-[#c9bfb5]">{sceneConfig.aspectRatio || '3:4'}</div>
              </div>
            </div>

            {/* Cost */}
            <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[rgba(139,115,85,0.02)]">
              <div className="w-12 h-16 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,160,106,0.08)' }}>
                <Sparkles className="w-5 h-5 text-[#d4a06a]" />
              </div>
              <div className="text-center">
                <div className="text-[10px] font-semibold text-[#b0a59a] uppercase">消耗</div>
                <div className="text-[11px] font-medium text-[#2d2422]">1 积分</div>
                <div className="text-[10px] text-[#c9bfb5]">{imageCount} 张参考图</div>
              </div>
            </div>
          </div>

          {/* Extra details row */}
          {(sceneConfig.prompt || modelConfig.pose || modelConfig.expression) && (
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {modelConfig.pose && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[rgba(139,115,85,0.04)] text-[#8b7355]">姿势: {modelConfig.pose}</span>
              )}
              {modelConfig.expression && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[rgba(139,115,85,0.04)] text-[#8b7355]">表情: {modelConfig.expression}</span>
              )}
              {sceneConfig.prompt && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[rgba(139,115,85,0.04)] text-[#8b7355] max-w-full truncate">提示词: {sceneConfig.prompt}</span>
              )}
            </div>
          )}

          {/* Developer JSON Toggle */}
          <div className="border-t border-[rgba(139,115,85,0.06)]">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium text-[#b0a59a] hover:text-[#8b7355] transition-colors"
              onClick={() => setShowJson(!showJson)}
            >
              开发者模式
              <ChevronDown className={`w-3 h-3 transition-transform ${showJson ? 'rotate-180' : ''}`} />
            </button>

            {showJson && (
              <div className="p-4 pt-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-semibold text-[#b0a59a] tracking-[0.15em] uppercase">
                    JSON 数据
                    {isJsonModified && (
                      <span className="ml-2 text-[10px] font-normal text-[#c67b5c] normal-case tracking-normal">（已修改）</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isJsonModified && (
                      <button
                        type="button"
                        onClick={handleResetJson}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[#8b7355] bg-[rgba(139,115,85,0.06)] hover:bg-[rgba(139,115,85,0.12)] transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        还原
                      </button>
                    )}
                    <CopyButton text={editedJson} />
                  </div>
                </div>
                {jsonError && (
                  <div className="mb-2 px-3 py-1.5 rounded-lg bg-[rgba(196,112,112,0.06)] text-[11px] text-[#c47070] border border-[rgba(196,112,112,0.1)]">
                    {jsonError}
                  </div>
                )}
                <textarea
                  value={editedJson}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="w-full text-[11px] text-[#5a5249] bg-[rgba(139,115,85,0.03)] rounded-xl p-3.5 leading-relaxed font-mono resize-y max-h-[400px] min-h-[200px] border border-[rgba(139,115,85,0.06)] focus:border-[rgba(198,123,92,0.3)] focus:outline-none focus:ring-1 focus:ring-[rgba(198,123,92,0.15)] transition-colors"
                  spellCheck={false}
                />
                {isJsonModified && !jsonError && (
                  <div className="mt-2 text-[10px] text-[#7d9b76]">
                    已修改 JSON，点击「生成」将使用修改后的数据提交
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button
        className="flex flex-col items-center justify-center w-full py-5 px-8 text-white border-none rounded-2xl text-base font-bold cursor-pointer transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
        style={{
          backgroundImage: disabled
            ? 'none'
            : 'linear-gradient(135deg, #c67b5c 0%, #d4a882 50%, #c67b5c 100%)',
          backgroundColor: disabled ? 'rgba(139,115,85,0.15)' : 'transparent',
          backgroundSize: disabled ? 'auto' : '200% 100%',
          boxShadow: disabled ? 'none' : '0 4px 24px rgba(198,123,92,0.3)',
        }}
        type="button"
        onClick={() => {
          if (isJsonModified && !jsonError) {
            try {
              const override = JSON.parse(editedJson);
              onGenerate(override);
            } catch {
              onGenerate();
            }
          } else {
            onGenerate();
          }
        }}
        disabled={disabled || !!jsonError}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundPosition = '100% 0';
            e.currentTarget.style.boxShadow = '0 8px 36px rgba(198,123,92,0.4)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundPosition = '0 0';
          e.currentTarget.style.boxShadow = disabled ? 'none' : '0 4px 24px rgba(198,123,92,0.3)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <div>{isSubmitting || isPolling ? '生成中...' : '开始生成'}</div>
        <div className="text-[11px] font-normal opacity-75 mt-1">消耗 1 积分 · 预计 30 秒</div>
      </button>

      {(currentTask || isPolling) && (
        <div className="mt-6">
          <TaskProgress task={currentTask} isPolling={isPolling} />
        </div>
      )}
      </>}
    </>
  );
}
