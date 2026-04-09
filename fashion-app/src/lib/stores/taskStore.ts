import { create } from 'zustand';
import { workspaceApi } from '@/lib/api/workspace';
import type { GenerationTask } from '@/lib/types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TaskState {
  currentTask: GenerationTask | null;
  isPolling: boolean;
  setCurrentTask: (task: GenerationTask | null) => void;
  clearTask: () => void;
  markPollingDone: () => void;
  /** SSE 模式：提交任务后等待 SSE 推送完成，同时保留轮询作为降级兜底 */
  pollTask: (taskId: string) => Promise<GenerationTask | null>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  currentTask: null,
  isPolling: false,

  setCurrentTask: (task) => set({ currentTask: task }),

  clearTask: () => set({ currentTask: null, isPolling: false }),

  markPollingDone: () => set({ isPolling: false }),

  /**
   * 提交任务后调用此方法。
   * 优先等待 SSE 推送结果（通过 useTaskSse hook 更新 currentTask）；
   * 同时每 3 秒轮询一次作为兜底，防止 SSE 连接不稳定时任务卡住。
   */
  pollTask: async (taskId) => {
    set({ isPolling: true });

    try {
      // 最多等待 3 分钟（60 次 × 3s）
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const task = get().currentTask;

        // 若 SSE 已推送完成，直接结束（SSE 推送 DONE，API 返回 COMPLETED）
        if (task && task.id === taskId && (task.status === 'DONE' || task.status === 'COMPLETED' || task.status === 'FAILED')) {
          set({ isPolling: false });
          return task;
        }

        // 每 3 秒也主动拉取一次作为兜底
        const fetched = await workspaceApi.getTask(taskId);
        set({ currentTask: fetched });

        if (fetched.status === 'DONE' || fetched.status === 'COMPLETED' || fetched.status === 'FAILED') {
          set({ isPolling: false });
          return fetched;
        }

        await sleep(3000);
      }
    } finally {
      set({ isPolling: false });
    }

    return null;
  },
}));
