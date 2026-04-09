import { create } from 'zustand';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  taskId?: string;
}

interface NotificationState {
  notifications: Notification[];
  add: (notification: Omit<Notification, 'id'>) => void;
  remove: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  add: (notification) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({ notifications: [...state.notifications, { ...notification, id }] }));
    // 5 秒后自动清除
    setTimeout(() => {
      set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
    }, 5000);
  },
  remove: (id) => set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
}));
