import type { GenerationTask, ModelConfig, SceneConfig, ClothingLength } from '@/lib/types';
import { mergeModelConfigWithCastingNarrative } from '@/lib/model-narrative';
import { TaskProgress } from '@/lib/components/common/TaskProgress';
import { Copy, CheckCheck, RotateCcw } from 'lucide-react';
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
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
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

function ImageViewer({ url, label }: { url: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-10 h-[53px] rounded-lg overflow-hidden border border-[rgba(139,115,85,0.1)] cursor-pointer flex-shrink-0"
        onClick={() => setExpanded(!expanded)}
      >
        <img src={url} alt={label} className="w-full h-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-[#2d2422]">{label}</div>
        {expanded ? (
          <div className="text-[10px] text-[#8b7355] break-all mt-0.5 select-all font-mono leading-relaxed">{url}</div>
        ) : (
          <div className="text-[10px] text-[#b0a59a] truncate">{url}</div>
        )}
      </div>
    </div>
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
}: StepFusionProps) {
  const disabled = !clothingUrl || isSubmitting || isPolling;
  const [editedJson, setEditedJson] = useState('');
  const [jsonError, setJsonError] = useState('');

  const getClothingLengthLabel = (cl?: ClothingLength) => {
    if (!cl) return '--';
    const map: Record<ClothingLength, string> = {
      cropped: '短款', standard: '标准', 'hip-length': '盖臀', 'knee-length': '膝盖长', 'ankle-length': '脚踝长',
    };
    return map[cl];
  };

  // 构建将要发送给接口的 payload（modelConfig 内附带 castingNarrative 全文，与落库一致）
  const payload = {
    clothingUrl,
    ...(clothingBackUrl ? { clothingBackUrl } : {}),
    ...(clothingDetailUrls?.filter(Boolean).length ? { clothingDetailUrls: clothingDetailUrls.filter(Boolean) } : {}),
    ...(clothingLength ? { clothingLength } : {}),
    modelConfig: mergeModelConfigWithCastingNarrative(modelConfig, sceneConfig.mode),
    sceneConfig,
  };

  // payload ref 用于追踪"原始"值（不被编辑器修改影响）
  const payloadRef = useRef(payload);
  const payloadJsonStr = JSON.stringify(payload, null, 2);

  // 当 payload 变化时同步到编辑器
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

  // 收集所有参考图片及排序
  const refImages: { url: string; label: string; order: number }[] = [];
  let order = 1;
  if (clothingUrl) refImages.push({ url: clothingUrl, label: '服装正面', order: order++ });
  if (clothingBackUrl) refImages.push({ url: clothingBackUrl, label: '服装背面', order: order++ });
  clothingDetailUrls?.filter(Boolean).forEach((u, i) => {
    refImages.push({ url: u, label: `服装细节${i + 1}`, order: order++ });
  });
  if (modelConfig.mode === 'upload' && modelConfig.imageUrl) {
    refImages.push({ url: modelConfig.imageUrl, label: '模特参考图', order: order++ });
  }
  if (sceneConfig.imageUrl) {
    refImages.push({ url: sceneConfig.imageUrl, label: '场景参考图', order: order++ });
  }

  return (
    <>
      <div className="mb-6">
        <h3 className="text-[17px] font-bold text-[#2d2422] tracking-tight">确认并生成</h3>
        <p className="hidden md:block text-[12px] text-[#9b8e82] mt-1 tracking-wide">
          确认参数后开始生成高质量街拍图
        </p>
      </div>

      {/* Data Preview - 发送数据预览 */}
      <div className="mb-6">
        <div className="rounded-2xl border border-[rgba(139,115,85,0.08)] overflow-hidden">
          {/* 参考图片 */}
          {refImages.length > 0 && (
            <div className="p-4 border-b border-[rgba(139,115,85,0.06)]">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-semibold text-[#b0a59a] tracking-[0.15em] uppercase">参考图片（按发送顺序）</div>
                <span className="text-[10px] text-[#c9bfb5]">{refImages.length} 张</span>
              </div>
              <div className="grid gap-3">
                {refImages.map((img, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl bg-[rgba(139,115,85,0.02)]">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[rgba(198,123,92,0.1)] text-[10px] font-bold text-[#c67b5c] flex-shrink-0 mt-0.5">
                      {img.order}
                    </div>
                    <div className="flex-1 min-w-0">
                      <ImageViewer url={img.url} label={img.label} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 关键参数 */}
          <div className="p-4 border-b border-[rgba(139,115,85,0.06)]">
            <div className="text-[10px] font-semibold text-[#b0a59a] tracking-[0.15em] uppercase mb-3">关键参数</div>
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2.5 rounded-lg bg-[rgba(139,115,85,0.02)]">
                <div className="text-[10px] text-[#b0a59a]">衣长</div>
                <div className="text-[12px] font-medium text-[#2d2422]">{getClothingLengthLabel(clothingLength)}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[rgba(139,115,85,0.02)]">
                <div className="text-[10px] text-[#b0a59a]">模特模式</div>
                <div className="text-[12px] font-medium text-[#2d2422]">{modelConfig.mode === 'upload' ? '参考图上传' : '文字生成'}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[rgba(139,115,85,0.02)]">
                <div className="text-[10px] text-[#b0a59a]">场景模式</div>
                <div className="text-[12px] font-medium text-[#2d2422]">
                  {sceneConfig.mode === 'replace' ? '替换模式' : sceneConfig.sceneSource === 'upload' ? '上传场景图' : '预设场景'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[rgba(139,115,85,0.02)]">
                <div className="text-[10px] text-[#b0a59a]">画幅比例</div>
                <div className="text-[12px] font-medium text-[#2d2422]">{sceneConfig.aspectRatio || '3:4'}</div>
              </div>
              {modelConfig.pose && (
                <div className="p-2.5 rounded-lg bg-[rgba(139,115,85,0.02)]">
                  <div className="text-[10px] text-[#b0a59a]">姿势</div>
                  <div className="text-[12px] font-medium text-[#2d2422]">{modelConfig.pose}</div>
                </div>
              )}
              {modelConfig.expression && (
                <div className="p-2.5 rounded-lg bg-[rgba(139,115,85,0.02)]">
                  <div className="text-[10px] text-[#b0a59a]">表情</div>
                  <div className="text-[12px] font-medium text-[#2d2422]">{modelConfig.expression}</div>
                </div>
              )}
              {sceneConfig.depthOfField && (
                <div className="p-2.5 rounded-lg bg-[rgba(139,115,85,0.02)]">
                  <div className="text-[10px] text-[#b0a59a]">景深</div>
                  <div className="text-[12px] font-medium text-[#2d2422]">{sceneConfig.depthOfField}</div>
                </div>
              )}
              {sceneConfig.grain && sceneConfig.grain !== 'none' && (
                <div className="p-2.5 rounded-lg bg-[rgba(139,115,85,0.02)]">
                  <div className="text-[10px] text-[#b0a59a]">胶片颗粒</div>
                  <div className="text-[12px] font-medium text-[#2d2422]">{sceneConfig.grain}</div>
                </div>
              )}
            </div>
            {sceneConfig.prompt && (
              <div className="mt-2 p-2.5 rounded-lg bg-[rgba(139,115,85,0.02)]">
                <div className="text-[10px] text-[#b0a59a] mb-1">补充提示词</div>
                <div className="text-[12px] font-medium text-[#2d2422] select-all">{sceneConfig.prompt}</div>
              </div>
            )}
          </div>

          {/* JSON Payload */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-semibold text-[#b0a59a] tracking-[0.15em] uppercase">
                完整 JSON 数据
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
              className="w-full text-[11px] text-[#5a5249] bg-[rgba(139,115,85,0.03)] rounded-xl p-3.5 leading-relaxed font-mono resize-y max-h-[600px] min-h-[280px] border border-[rgba(139,115,85,0.06)] focus:border-[rgba(198,123,92,0.3)] focus:outline-none focus:ring-1 focus:ring-[rgba(198,123,92,0.15)] transition-colors"
              spellCheck={false}
            />
            {isJsonModified && !jsonError && (
              <div className="mt-2 text-[10px] text-[#7d9b76]">
                已修改 JSON 数据，点击「生成」按钮将使用修改后的数据提交
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
        <div>{isSubmitting || isPolling ? '生成中...' : '生成'}</div>
        <div className="text-[11px] font-normal opacity-75 mt-1">消耗 1 积分</div>
      </button>

      {(currentTask || isPolling) && (
        <div className="mt-6">
          <TaskProgress task={currentTask} isPolling={isPolling} />
        </div>
      )}
    </>
  );
}
