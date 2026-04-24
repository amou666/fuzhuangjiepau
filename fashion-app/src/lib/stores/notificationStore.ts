import { create } from 'zustand';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  taskId?: string;
}

interface NotificationState {
  notifications: Notification[];
  /** 已通知过的 taskId 集合，防止同一任务重复弹出 */
  notifiedTaskIds: Set<string>;
  add: (notification: Omit<Notification, 'id'>) => void;
  remove: (id: string) => void;
}

const MAX_NOTIFICATIONS = 3;
const AUTO_REMOVE_MS = 6000;
const autoRemoveTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * 持久化 notifiedTaskIds 到 sessionStorage，防止页面刷新后丢失。
 * 这样 SSE 重连时不会对已经通知过的任务重复弹 Toast。
 */
function loadNotifiedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem('notifiedTaskIds')
    if (raw) {
      const arr = JSON.parse(raw) as string[]
      return new Set(arr.slice(-200))
    }
  } catch {}
  return new Set<string>()
}

function saveNotifiedIds(ids: Set<string>) {
  try {
    const arr = Array.from(ids).slice(-200)
    sessionStorage.setItem('notifiedTaskIds', JSON.stringify(arr))
  } catch {}
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  notifiedTaskIds: loadNotifiedIds(),

  add: (notification) => {
    if (notification.taskId) {
      const { notifiedTaskIds } = get();
      if (notifiedTaskIds.has(notification.taskId)) return;
      const next = new Set(notifiedTaskIds);
      next.add(notification.taskId);
      if (next.size > 200) {
        const arr = Array.from(next);
        const trimmed = new Set(arr.slice(arr.length - 100));
        set({ notifiedTaskIds: trimmed });
        saveNotifiedIds(trimmed);
      } else {
        set({ notifiedTaskIds: next });
        saveNotifiedIds(next);
      }
    }

    const id = `${Date.now()}-${Math.random()}`;
    set((state) => {
      const updated = [...state.notifications, { ...notification, id }];
      return { notifications: updated.slice(-MAX_NOTIFICATIONS) };
    });

    const timer = setTimeout(() => {
      autoRemoveTimers.delete(id);
      set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
    }, AUTO_REMOVE_MS);
    autoRemoveTimers.set(id, timer);
  },

  remove: (id) => {
    const timer = autoRemoveTimers.get(id);
    if (timer) { clearTimeout(timer); autoRemoveTimers.delete(id); }
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
  },
}));
