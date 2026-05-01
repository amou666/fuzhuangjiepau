'use client'

import { useState, useCallback, useEffect, memo } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProfileMe, useCreditHistory, useGenerationStats, useCreditSummary, type GenerationStatsData, type CreditSummaryData } from '@/lib/hooks/useSWRCache'
import { formatDateTime } from '@/lib/utils/format'
import { useRouter } from 'next/navigation'
import { Mail, Shield, Key, Coins, Lightbulb, ArrowUp, ArrowDown, UserCircle, Copy, Check, Target, Zap, Image, TrendingUp, Loader2, BookOpen, ArrowRight, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { MiniBarChart } from '@/lib/components/charts/MiniBarChart'

const StatCard = memo(function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="fashion-glass rounded-2xl p-3 md:p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <span className="text-xs font-semibold text-[var(--text-quaternary)] tracking-wider uppercase">{label}</span>
      </div>
      <div className="text-3xl font-bold text-[var(--text-primary)] leading-none">{value}</div>
      {sub && <div className="text-xs text-[var(--text-quaternary)] mt-1.5">{sub}</div>}
    </div>
  )
})

export default function ProfileContent() {
  const router = useRouter()
  const authUser = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const updateCredits = useAuthStore((state) => state.updateCredits)
  const credits = useAuthStore((s) => s.user?.credits ?? 0)

  // SWR 缓存 hook —— 切回页面时先显 localStorage 缓存，后台再刷新
  const { profileUser, mutateProfile, isRefreshing: profileRefreshing, refresh: refreshProfile } = useProfileMe()
  const { creditLogs, mutateCreditHistory, isRefreshing: creditRefreshing, refresh: refreshCredit } = useCreditHistory()
  const { genStats, isLoading: statsLoading, isRefreshing: statsRefreshing, hasCache: statsHasCache } = useGenerationStats()
  const { creditSummary, isRefreshing: summaryRefreshing } = useCreditSummary()

  const anyRefreshing = profileRefreshing || creditRefreshing || statsRefreshing || summaryRefreshing

  const handleRefreshAll = async () => {
    await Promise.allSettled([refreshProfile(), refreshCredit()])
  }

  // SWR 成功后同步到 authStore（useEffect 避免渲染期间 setState）
  useEffect(() => {
    if (profileUser && (profileUser.id !== authUser?.id || profileUser.credits !== authUser?.credits)) {
      setUser(profileUser)
      if (profileUser.credits !== undefined) {
        updateCredits(profileUser.credits)
      }
    }
  }, [profileUser, authUser?.id, authUser?.credits, setUser, updateCredits])

  const [copied, setCopied] = useState(false)
  const [creditPage, setCreditPage] = useState(1)
  const CREDIT_PAGE_SIZE = 10

  const user = profileUser ?? authUser

  const handleCopyApiKey = useCallback(() => {
    if (!user?.apiKey) return
    navigator.clipboard.writeText(user.apiKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [user?.apiKey])

  const infoItems = [
    { label: '邮箱', value: user?.email, icon: Mail, color: '#c67b5c' },
    { label: '角色', value: user?.role === 'ADMIN' ? '管理员' : '客户', icon: Shield, color: 'var(--text-secondary)' },
    { label: '积分余额', value: String(user?.credits ?? 0), icon: Coins, color: '#d4a06a' },
  ]

  const ov = genStats?.overview
  const daily = genStats?.dailyStats ?? []
  const creditDaily = creditSummary?.dailyStats ?? []

  const dailyChartData = [...daily].reverse().slice(-14).map((d) => ({
    label: d.date.slice(5),
    value: Number(d.total) || 0,
  }))

  const creditChartData = [...creditDaily].reverse().slice(-14).map((d) => ({
    label: d.date.slice(5),
    value: Number(d.spent) || 0,
    color: '#c67b5c',
  }))

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="md:hidden flex items-center gap-2.5 -mb-1">
        <div
          className="hidden w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #8b7355 0%, #b0a59a 100%)' }}
        >
          <UserCircle className="w-4 h-4 text-white" />
        </div>
        <h1 className="hidden text-lg font-bold tracking-tight text-[var(--text-primary)] flex-1">个人中心</h1>
        <button
          type="button"
          onClick={() => void handleRefreshAll()}
          disabled={anyRefreshing}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
          style={{
            background: anyRefreshing ? 'rgba(198,123,92,0.08)' : 'rgba(139,115,85,0.03)',
            borderColor: anyRefreshing ? 'rgba(198,123,92,0.2)' : 'rgba(139,115,85,0.08)',
            color: anyRefreshing ? '#c67b5c' : '#8b7355',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" style={{ animation: anyRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          {anyRefreshing ? '刷新中' : '刷新数据'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Account Info */}
        <div className="fashion-glass rounded-2xl p-4 md:p-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">账号信息</h2>
          <div className="flex flex-col gap-3.5">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}12` }}
                >
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--text-quaternary)] uppercase tracking-wider">{item.label}</div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{item.value}</div>
                </div>
              </div>
            ))}

            {/* ApiKey */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(125,155,118,0.1)' }}
              >
                <Key className="w-4 h-4 text-[#7d9b76]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[var(--text-quaternary)] uppercase tracking-wider">API KEY</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs text-[var(--text-secondary)] bg-[var(--bg-muted)] px-2 py-0.5 rounded-md font-mono truncate">
                    {user?.apiKey ?? '-'}
                  </code>
                  {user?.apiKey && (
                    <button
                      type="button"
                      className="p-1 rounded-md text-[var(--text-quaternary)] hover:text-[#c67b5c] hover:bg-[var(--bg-active)] transition-all flex-shrink-0"
                      onClick={handleCopyApiKey}
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#7d9b76]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="fashion-glass rounded-2xl p-4 md:p-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#d4a06a]" />
            使用提示
          </h2>
          <div className="flex flex-col gap-3">
            <div className="px-4 py-3 bg-[rgba(212,160,106,0.06)] border border-[rgba(212,160,106,0.12)] rounded-2xl text-sm text-[var(--text-secondary)] leading-relaxed">
              生图功能使用你专属的 AI API Key，请联系管理员获取或配置。
            </div>
            <div className="px-4 py-3 bg-[rgba(125,155,118,0.06)] border border-[rgba(125,155,118,0.12)] rounded-2xl text-sm text-[#5a7a53] leading-relaxed">
              若积分不足，请联系管理员为你充值。
            </div>
            <div className="px-4 py-3 bg-[var(--bg-active)] border border-[rgba(198,123,92,0.12)] rounded-2xl text-sm text-[#b0654a] leading-relaxed">
              在工作台、模特工厂、AI 改款中生成的图片都会消耗积分，可在下方查看流水。
            </div>
            <button
              type="button"
              onClick={() => router.push('/tutorials')}
              className="flex items-center justify-between px-4 py-3 rounded-2xl transition-all border"
              style={{
                background: 'linear-gradient(135deg, rgba(139,115,85,0.06), rgba(176,165,154,0.06))',
                borderColor: 'rgba(139,115,85,0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,115,85,0.1), rgba(176,165,154,0.1))'
                e.currentTarget.style.borderColor = 'rgba(139,115,85,0.35)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,115,85,0.06), rgba(176,165,154,0.06))'
                e.currentTarget.style.borderColor = 'rgba(139,115,85,0.2)'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b7355, #b0a59a)' }}>
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">使用教程</div>
                  <div className="text-xs text-[var(--text-quaternary)]">查看所有功能的详细操作指南</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* 数据统计 */}
      <div className="fashion-glass rounded-2xl p-4 md:p-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#c67b5c]" />
          数据统计
        </h2>
        {statsLoading && !statsHasCache ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[#c67b5c] animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <StatCard icon={Image} label="总生图" value={ov?.totalTasks ?? 0} sub={`成功率 ${ov?.successRate ?? 0}%`} color="#c67b5c" />
              <StatCard icon={Target} label="成功" value={ov?.successTasks ?? 0} sub={`失败 ${ov?.failedTasks ?? 0}`} color="#7d9b76" />
              <StatCard icon={Coins} label="总消耗" value={creditSummary?.totalSpent ?? 0} sub={`充值 ${creditSummary?.totalRecharged ?? 0}`} color="#d4a06a" />
              <StatCard icon={Zap} label="当前积分" value={credits} sub="可用余额" color="#8b7355" />
            </div>

            {/* Daily Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-muted)] p-3 md:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-3.5 h-3.5 text-[#c67b5c]" />
                  <span className="text-xs font-semibold text-[var(--text-primary)]">每日生图量</span>
                  <span className="text-xs text-[var(--text-extreme)] ml-auto">近14天</span>
                </div>
                <MiniBarChart data={dailyChartData} height={80} />
              </div>

              <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-muted)] p-3 md:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Coins className="w-3.5 h-3.5 text-[#d4a06a]" />
                  <span className="text-xs font-semibold text-[var(--text-primary)]">每日积分消耗</span>
                  <span className="text-xs text-[var(--text-extreme)] ml-auto">近14天</span>
                </div>
                <MiniBarChart data={creditChartData} height={80} barColor="#d4a06a" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Credit History */}
      <div className="fashion-glass rounded-2xl p-4 md:p-6">
        <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Coins className="w-4 h-4 text-[#d4a06a]" />
          积分记录
        </h2>
        {creditLogs.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-extreme)]">暂无积分变动记录</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-quaternary)] uppercase tracking-wider border-b border-[var(--border-light)] bg-[var(--bg-muted)]">变动</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-quaternary)] uppercase tracking-wider border-b border-[var(--border-light)] bg-[var(--bg-muted)]">余额</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-quaternary)] uppercase tracking-wider border-b border-[var(--border-light)] bg-[var(--bg-muted)]">原因</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-quaternary)] uppercase tracking-wider border-b border-[var(--border-light)] bg-[var(--bg-muted)]">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {creditLogs.slice((creditPage - 1) * CREDIT_PAGE_SIZE, creditPage * CREDIT_PAGE_SIZE).map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--bg-muted)] transition-colors">
                      <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)]">
                        <span className={`inline-flex items-center gap-1 font-semibold ${log.delta > 0 ? 'text-[#7d9b76]' : 'text-[#c47070]'}`}>
                          {log.delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                          {log.delta > 0 ? `+${log.delta}` : log.delta}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)] text-[var(--text-primary)] font-medium">{log.balanceAfter}</td>
                      <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)] text-[var(--text-secondary)]">{log.reason}</td>
                      <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)] text-[var(--text-quaternary)]">{formatDateTime(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Math.ceil(creditLogs.length / CREDIT_PAGE_SIZE) > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-light)]">
                <span className="text-xs text-[var(--text-quaternary)]">共 {creditLogs.length} 条记录</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditPage(p => Math.max(1, p - 1))}
                    disabled={creditPage === 1}
                    className="w-7 h-7 rounded-2xl flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-active)]"
                  >
                    <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>
                  <span className="text-xs text-[var(--text-secondary)] tabular-nums min-w-[50px] text-center">{creditPage} / {Math.ceil(creditLogs.length / CREDIT_PAGE_SIZE)}</span>
                  <button
                    type="button"
                    onClick={() => setCreditPage(p => Math.min(Math.ceil(creditLogs.length / CREDIT_PAGE_SIZE), p + 1))}
                    disabled={creditPage >= Math.ceil(creditLogs.length / CREDIT_PAGE_SIZE)}
                    className="w-7 h-7 rounded-2xl flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--bg-active)]"
                  >
                    <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
