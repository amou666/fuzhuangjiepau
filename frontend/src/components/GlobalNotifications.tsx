import { useNotificationStore } from '../stores/notificationStore';

export function GlobalNotifications() {
  const notifications = useNotificationStore((state) => state.notifications);
  const remove = useNotificationStore((state) => state.remove);

  if (notifications.length === 0) return null;

  return (
    <div className="global-notifications">
      {notifications.map((n) => (
        <div key={n.id} className={`toast toast-${n.type}`}>
          <span className="toast-icon">
            {n.type === 'success' ? '✓' : n.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span className="toast-message">{n.message}</span>
          <button className="toast-close" onClick={() => remove(n.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}
