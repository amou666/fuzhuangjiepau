import { create } from 'zustand';
import { workspaceApi } from '@/lib/api/workspace';
import type { GenerationTask } from '@/lib/types';

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });

interface TaskState {
  currentTask: GenerationTask | null;
  isPolling: boolean;
  setCurrentTask: (task: GenerationTask | null) => void;
  clearTask: () => void;
  markPollingDone: () => void;
  pollTask: (taskId: string) => Promise<GenerationTask | null>;
  abortPolling: () => void;

  batchTasks: GenerationTask[];
  isBatchPolling: boolean;
  setBatchTasks: (tasks: GenerationTask[]) => void;
  clearBatch: () => void;
  pollBatchTasks: (taskIds: string[]) => Promise<GenerationTask[]>;
  abortBatchPolling: () => void;
}

const isTerminal = (status: string) =>
  status === 'DONE' || status === 'COMPLETED' || status === 'FAILED';

let pollAbort: AbortController | null = null;
let batchPollAbort: AbortController | null = null;

export const useTaskStore = create<TaskState>((set, get) => ({
  currentTask: null,
  isPolling: false,

  setCurrentTask: (task) => set({ currentTask: task }),

  clearTask: () => {
    pollAbort?.abort();
    pollAbort = null;
    set({ currentTask: null, isPolling: false });
  },

  markPollingDone: () => {
    pollAbort?.abort();
    pollAbort = null;
    set({ isPolling: false });
  },

  abortPolling: () => {
    pollAbort?.abort();
    pollAbort = null;
    set({ isPolling: false });
  },

  pollTask: async (taskId) => {
    pollAbort?.abort();
    const ac = new AbortController();
    pollAbort = ac;
    set({ isPolling: true });

    try {
      for (let attempt = 0; attempt < 60; attempt += 1) {
        if (ac.signal.aborted) break;

        const task = get().currentTask;
        if (task && task.id === taskId && isTerminal(task.status)) {
          set({ isPolling: false });
          return task;
        }

        const fetched = await workspaceApi.getTask(taskId);
        set({ currentTask: fetched });

        if (isTerminal(fetched.status)) {
          set({ isPolling: false });
          return fetched;
        }

        await sleep(3000, ac.signal);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // graceful abort
      } else {
        throw e;
      }
    } finally {
      if (pollAbort === ac) pollAbort = null;
      set({ isPolling: false });
    }

    return null;
  },

  batchTasks: [],
  isBatchPolling: false,

  setBatchTasks: (tasks) => set({ batchTasks: tasks }),

  clearBatch: () => {
    batchPollAbort?.abort();
    batchPollAbort = null;
    set({ batchTasks: [], isBatchPolling: false });
  },

  abortBatchPolling: () => {
    batchPollAbort?.abort();
    batchPollAbort = null;
    set({ isBatchPolling: false });
  },

  pollBatchTasks: async (taskIds) => {
    batchPollAbort?.abort();
    const ac = new AbortController();
    batchPollAbort = ac;
    set({ isBatchPolling: true });

    try {
      for (let attempt = 0; attempt < 80; attempt += 1) {
        if (ac.signal.aborted) break;

        const current = get().batchTasks;
        const pendingIds = taskIds.filter((id) => {
          const t = current.find((x) => x.id === id);
          return !t || !isTerminal(t.status);
        });

        if (pendingIds.length === 0) {
          set({ isBatchPolling: false });
          return get().batchTasks;
        }

        const fetched = await Promise.all(
          pendingIds.map((id) => workspaceApi.getTask(id).catch(() => null)),
        );

        set((state) => {
          const updated = [...state.batchTasks];
          for (const task of fetched) {
            if (!task) continue;
            const idx = updated.findIndex((t) => t.id === task.id);
            if (idx >= 0) {
              updated[idx] = task;
            } else {
              updated.push(task);
            }
          }
          return { batchTasks: updated };
        });

        const allDone = taskIds.every((id) => {
          const t = get().batchTasks.find((x) => x.id === id);
          return t && isTerminal(t.status);
        });

        if (allDone) {
          set({ isBatchPolling: false });
          return get().batchTasks;
        }

        await sleep(3000, ac.signal);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // graceful abort
      } else {
        throw e;
      }
    } finally {
      if (batchPollAbort === ac) batchPollAbort = null;
      set({ isBatchPolling: false });
    }

    return get().batchTasks;
  },
}));
