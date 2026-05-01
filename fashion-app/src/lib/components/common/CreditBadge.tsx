import { useAuthStore } from '@/lib/stores/authStore';

export function CreditBadge() {
  const credits = useAuthStore((state) => state.user?.credits ?? 0);

  return (
    <div
      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-white rounded-full text-sm font-semibold"
      style={{
        background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
        boxShadow: '0 2px 10px rgba(198,123,92,0.2)',
      }}
    >
      {credits} 积分
    </div>
  );
}
