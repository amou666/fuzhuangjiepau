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

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  notifiedTaskIds: new Set<string>(),

  add: (notification) => {
    // 如果带 taskId，检查是否已经通知过该任务
    if (notification.taskId) {
      const { notifiedTaskIds } = get();
      if (notifiedTaskIds.has(notification.taskId)) return;
      // 标记为已通知
      const next = new Set(notifiedTaskIds);
      next.add(notification.taskId);
      // 限制集合大小，防止内存泄漏
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
      // 只保留最新的一条通知
      const updated = [...state.notifications, { ...notification, id }];
      return { notifications: updated.slice(-MAX_NOTIFICATIONS) };
    });

    // 5 秒后自动清除
    setTimeout(() => {
      set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
    }, 5000);
  },

  remove: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
}));
