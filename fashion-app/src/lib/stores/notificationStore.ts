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

const MAX_NOTIFICATIONS = 1;
const autoRemoveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  notifiedTaskIds: new Set<string>(),

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
      } else {
        set({ notifiedTaskIds: next });
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
    }, 5000);
    autoRemoveTimers.set(id, timer);
  },

  remove: (id) => {
    const timer = autoRemoveTimers.get(id);
    if (timer) { clearTimeout(timer); autoRemoveTimers.delete(id); }
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
  },
}));
