import type { GenerationTask } from '@/lib/types';
import { formatDateTime } from '@/lib/utils/format';

interface TaskProgressProps {
  task: GenerationTask | null;
  isPolling?: boolean;
}

const getStatusText = (status: GenerationTask['status']) => {
  const map: Record<string, string> = {
    PENDING: '等待中',
    PROCESSING: '处理中',
    ANALYZING_CLOTHING: '分析服装',
    DESCRIBING_MODEL: '描述模特',
    DESCRIBING_SCENE: '描述场景',
    GENERATING: '生成中',
    COMPLETED: '已完成',
    DONE: '已完成',
    FAILED: '失败',
  };
  return map[status] || status;
};

const getStatusColor = (status: GenerationTask['status']) => {
  if (status === 'DONE' || status === 'COMPLETED') return '#10b981';
  if (status === 'FAILED') return '#ef4444';
  return '#f59e0b';
};

export function TaskProgress({ task, isPolling = false }: TaskProgressProps) {
  if (!task) {
    return (
      <div className="task-progress">
        <div style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>
          还没有进行中的任务
        </div>
      </div>
    );
  }

  const progress = (task.status === 'DONE' || task.status === 'COMPLETED') ? 100 : task.status === 'PROCESSING' ? 60 : 20;

  return (
    <div className="task-progress">
      <div className="task-progress-header">
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: getStatusColor(task.status),
            animation: isPolling ? 'pulse 1.5s infinite' : undefined,
          }}
        />
        <span className="task-progress-status">{getStatusText(task.status)}</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af' }}>
          ID: {task.id.slice(0, 8)}
        </span>
      </div>

      <div className="task-progress-bar">
        <div
          className="task-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginTop: '16px',
          fontSize: '12px',
        }}
      >
        <div>
          <span style={{ color: '#9ca3af' }}>创建时间: </span>
          <span style={{ color: '#374151' }}>{formatDateTime(task.createdAt)}</span>
        </div>
        <div>
          <span style={{ color: '#9ca3af' }}>消耗积分: </span>
          <span style={{ color: '#374151' }}>{task.creditCost}</span>
        </div>
      </div>

      {task.resultUrl && (
        <div className="task-progress-result">
          <img src={task.resultUrl} alt="生成结果" />
        </div>
      )}

      {task.errorMsg && (
        <div style={{ marginTop: '12px', padding: '12px', background: '#fef2f2', borderRadius: '6px', color: '#ef4444', fontSize: '13px' }}>
          失败原因: {task.errorMsg}
        </div>
      )}

      {isPolling && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="loading-spinner" />
          正在处理中...
        </div>
      )}
    </div>
  );
}
