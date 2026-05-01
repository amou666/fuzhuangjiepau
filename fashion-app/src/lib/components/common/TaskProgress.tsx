import type { GenerationTask } from '@/lib/types';
import { formatDateTime } from '@/lib/utils/format';
import { Loader2, Clock, Coins, AlertCircle } from 'lucide-react';

interface TaskProgressProps {
  task: GenerationTask | null;
  isPolling?: boolean;
}

const getStatusText = (status: GenerationTask['status']) => {
  const map: Record<string, string> = {
    PENDING: '等待中',
    PROCESSING: '处理中',
    DESCRIBING_MODEL: '描述模特',
    DESCRIBING_SCENE: '描述场景',
    GENERATING: '生成中',
    COMPLETED: '已完成',
    FAILED: '失败',
  };
  return map[status] || status;
};

const getStatusColor = (status: GenerationTask['status']) => {
  if (status === 'COMPLETED') return '#7d9b76';
  if (status === 'FAILED') return '#c47070';
  return '#d4a06a';
};

export function TaskProgress({ task, isPolling = false }: TaskProgressProps) {
  if (!task) {
    return (
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'rgba(250,247,244,0.72)',
          border: '1px solid var(--border-light)',
          boxShadow: '0 1px 2px rgba(139,115,85,0.04), 0 4px 16px rgba(139,115,85,0.06)',
        }}
      >
        <div className="text-center text-[var(--text-extreme)] py-4 text-sm">还没有进行中的任务</div>
      </div>
    );
  }

  const progress = task.status === 'COMPLETED' ? 100 : task.status === 'GENERATING' ? 80 : task.status === 'PROCESSING' ? 60 : task.status === 'DESCRIBING_MODEL' ? 30 : task.status === 'DESCRIBING_SCENE' ? 50 : 20;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(250,247,244,0.72)',
        border: '1px solid var(--border-light)',
        boxShadow: '0 1px 2px rgba(139,115,85,0.04), 0 4px 16px rgba(139,115,85,0.06)',
      }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: getStatusColor(task.status),
            animation: isPolling ? 'pulse 1.5s infinite' : undefined,
          }}
        />
        <span className="text-sm font-semibold text-[var(--text-primary)]">{getStatusText(task.status)}</span>
        <span className="ml-auto text-xs text-[var(--text-extreme)]">
          {task.id.slice(0, 8)}
        </span>
      </div>

      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(139,115,85,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #c67b5c, #d4a882)',
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-[var(--text-quaternary)]" />
          <span className="text-[var(--text-quaternary)]">创建: </span>
          <span className="text-[var(--text-secondary)]">{formatDateTime(task.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Coins className="w-3 h-3 text-[var(--text-quaternary)]" />
          <span className="text-[var(--text-quaternary)]">积分: </span>
          <span className="text-[var(--text-secondary)]">{task.creditCost}</span>
        </div>
      </div>

      {(task.resultUrls?.[0] || task.resultUrl) && (
        <div className="mt-4 rounded-2xl overflow-hidden border border-[var(--border-light)]">
          <img src={task.resultUrls?.[0] || task.resultUrl!} alt="生成结果" className="w-full block" />
        </div>
      )}

      {task.errorMsg && (
        <div
          className="mt-3 p-3 rounded-2xl text-sm flex items-start gap-2"
          style={{ background: 'rgba(196,112,112,0.05)', color: '#c47070', border: '1px solid rgba(196,112,112,0.1)' }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {task.errorMsg}
        </div>
      )}

      {isPolling && (
        <div className="mt-3 text-xs text-[var(--text-tertiary)] flex items-center gap-2">
          <Loader2
            className="w-4 h-4 animate-spin"
            style={{ color: '#c67b5c' }}
          />
          正在处理中...
        </div>
      )}
    </div>
  );
}
