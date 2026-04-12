import { useNotificationStore } from '@/lib/stores/notificationStore';
import { Check, X, Info } from 'lucide-react';

export function GlobalNotifications() {
  const notifications = useNotificationStore((state) => state.notifications);
  const remove = useNotificationStore((state) => state.remove);

  if (notifications.length === 0) return null;

  const typeStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    success: {
      bg: 'rgba(125,155,118,0.08)',
      border: 'rgba(125,155,118,0.15)',
      text: '#5a7a52',
      icon: '#7d9b76',
    },
    error: {
      bg: 'rgba(196,112,112,0.08)',
      border: 'rgba(196,112,112,0.15)',
      text: '#9b5555',
      icon: '#c47070',
    },
    info: {
      bg: 'rgba(198,123,92,0.08)',
      border: 'rgba(198,123,92,0.15)',
      text: '#8b6344',
      icon: '#c67b5c',
    },
  };

  const IconMap = {
    success: Check,
    error: X,
    info: Info,
  };

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-[380px]">
      {notifications.map((n) => {
        const Icon = IconMap[n.type] || Info;
        const style = typeStyles[n.type] || typeStyles.info;
        return (
          <div
            key={n.id}
            className="flex items-start gap-3 px-5 py-4 rounded-2xl backdrop-blur-xl animate-[toast-slide-in_0.3s_ease]"
            style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
              boxShadow: '0 4px 20px rgba(139,115,85,0.08)',
            }}
          >
            <span
              className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
              style={{ background: style.icon }}
            >
              <Icon className="w-3 h-3" />
            </span>
            <span className="flex-1 text-sm font-medium leading-relaxed" style={{ color: style.text }}>
              {n.message}
            </span>
            <button
              className="bg-transparent border-none text-inherit opacity-50 text-sm cursor-pointer p-0 flex-shrink-0 mt-0.5 hover:opacity-100 transition-opacity"
              onClick={() => remove(n.id)}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
