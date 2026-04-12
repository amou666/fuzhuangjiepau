import { useState } from 'react';
import type { GenerationTask } from '@/lib/types';
import { workspaceApi } from '@/lib/api/workspace';
import { Loader2, CheckCircle2, XCircle, Clock, PackageCheck } from 'lucide-react';

interface BatchProgressProps {
  tasks: GenerationTask[];
  isPolling: boolean;
}

const isTerminal = (status: string) =>
  status === 'DONE' || status === 'COMPLETED' || status === 'FAILED';

export function BatchProgress({ tasks, isPolling }: BatchProgressProps) {
  const [downloading, setDownloading] = useState(false);

  if (tasks.length === 0 && !isPolling) return null;

  const completed = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'DONE');
  const failed = tasks.filter((t) => t.status === 'FAILED');
  const pending = tasks.filter((t) => !isTerminal(t.status));
  const progress = tasks.length > 0 ? Math.round((completed.length + failed.length) / tasks.length * 100) : 0;
  const allDone = pending.length === 0 && tasks.length > 0;

  const handleDownloadAll = async () => {
    const ids = completed.map((t) => t.id);
    if (ids.length === 0) return;
    setDownloading(true);
    try {
      await workspaceApi.downloadBatchZip(ids);
    } catch {
      alert('打包下载失败，请重试');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(255,253,250,0.72)',
        border: '1px solid rgba(139,115,85,0.06)',
        boxShadow: '0 1px 2px rgba(139,115,85,0.04), 0 4px 16px rgba(139,115,85,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {isPolling && (
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#c67b5c' }} />
          )}
          <span className="text-[14px] font-semibold text-[#2d2422]">
            批量生成进度
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          {completed.length > 0 && (
            <span className="flex items-center gap-1 text-[#7d9b76]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {completed.length} 成功
            </span>
          )}
          {failed.length > 0 && (
            <span className="flex items-center gap-1 text-[#c47070]">
              <XCircle className="w-3.5 h-3.5" />
              {failed.length} 失败
            </span>
          )}
          {pending.length > 0 && (
            <span className="flex items-center gap-1 text-[#d4a06a]">
              <Clock className="w-3.5 h-3.5" />
              {pending.length} 进行中
            </span>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(139,115,85,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: failed.length > 0 && completed.length === 0
              ? '#c47070'
              : 'linear-gradient(90deg, #c67b5c, #d4a882)',
          }}
        />
      </div>

      {/* Task grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tasks.map((task, i) => (
          <div
            key={task.id}
            className="rounded-xl overflow-hidden border transition-all duration-300"
            style={{
              borderColor: isTerminal(task.status)
                ? task.status === 'FAILED'
                  ? 'rgba(196,112,112,0.15)'
                  : 'rgba(125,155,118,0.15)'
                : 'rgba(139,115,85,0.08)',
              background: isTerminal(task.status)
                ? task.status === 'FAILED'
                  ? 'rgba(196,112,112,0.03)'
                  : 'rgba(255,253,250,1)'
                : 'rgba(139,115,85,0.02)',
            }}
          >
            {/* Result image or placeholder */}
            <div className="aspect-[3/4] relative">
              {(task.resultUrls?.[0] || task.resultUrl) ? (
                <img
                  src={task.resultUrls?.[0] || task.resultUrl!}
                  alt={`结果 ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  {task.status === 'FAILED' ? (
                    <XCircle className="w-6 h-6 text-[#c47070]" />
                  ) : (
                    <Loader2 className="w-6 h-6 animate-spin text-[#c67b5c]" />
                  )}
                  <span className="text-[10px] text-[#b0a59a]">
                    {task.status === 'FAILED' ? '失败' : getShortStatus(task.status)}
                  </span>
                </div>
              )}

              {/* Index badge */}
              <div
                className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  color: '#8b7355',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                {i + 1}
              </div>

              {/* Status indicator */}
              {isTerminal(task.status) && (
                <div className="absolute top-1.5 right-1.5">
                  {task.status === 'FAILED' ? (
                    <XCircle className="w-4 h-4 text-[#c47070] drop-shadow" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#7d9b76] drop-shadow" />
                  )}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="px-2 py-1.5">
              <div className="text-[10px] text-[#b0a59a] truncate">
                {getTaskLabel(task)}
              </div>
              {task.errorMsg && (
                <div className="text-[9px] text-[#c47070] truncate mt-0.5">{task.errorMsg}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isPolling && (
        <div className="mt-4 text-[11px] text-[#9b8e82] text-center">
          正在生成中，完成后会自动显示结果...
        </div>
      )}

      {allDone && completed.length > 0 && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
              boxShadow: '0 2px 12px rgba(198,123,92,0.25)',
            }}
            onClick={handleDownloadAll}
            disabled={downloading}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(198,123,92,0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(198,123,92,0.25)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {downloading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> 打包中...</>
              : <><PackageCheck className="w-4 h-4" /> 打包下载全部 ({completed.length} 张)</>
            }
          </button>
        </div>
      )}
    </div>
  );
}

function getShortStatus(status: string) {
  const map: Record<string, string> = {
    PENDING: '排队中',
    PROCESSING: '处理中',
    DESCRIBING_MODEL: '分析模特',
    DESCRIBING_SCENE: '分析场景',
    GENERATING: '生成中',
  };
  return map[status] || status;
}

function getTaskLabel(task: GenerationTask) {
  try {
    const sc = task.sceneConfig;
    const mc = task.modelConfig;
    const parts: string[] = [];
    if (mc?.pose) {
      const poseLabel = mc.pose.match(/（(.+?)）/)?.[1] || mc.pose.split('（')[0];
      parts.push(poseLabel);
    }
    if (sc?.preset) {
      const sceneLabel = sc.preset.match(/（(.+?)）/)?.[1] || sc.preset.split('（')[0];
      parts.push(sceneLabel);
    }
    return parts.join(' · ') || '变体';
  } catch {
    return '变体';
  }
}
