import { useAuthStore } from '../../stores/authStore';

export function CreditBadge() {
  const credits = useAuthStore((state) => state.user?.credits ?? 0);

  return <div className="credit-badge">剩余积分：{credits}</div>;
}
