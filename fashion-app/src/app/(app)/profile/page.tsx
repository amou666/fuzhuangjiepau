'use client'

import { useEffect, useState } from 'react'
import { authApi } from '@/lib/api/auth'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import type { CreditLog } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/api'
import { formatDateTime } from '@/lib/utils/format'
import { useRouter } from 'next/navigation'
import { Mail, Shield, Key, Coins, Lightbulb, ArrowUp, ArrowDown, UserCircle, Copy, Check, Target, Zap, Image, TrendingUp, Loader2, BookOpen, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { MiniBarChart } from '@/lib/components/charts/MiniBarChart'

interface GenerationStats {
  overview: {
    totalTasks: number
    successTasks: number
    failedTasks: number
    pendingTasks: number
    successRate: string
  }
  modelPreferences: {
    gender: Record<string, number>
    bodyType: Record<string, number>
    pose: Record<string, number>
  }
  scenePreferences: {
    preset: Record<string, number>
  }
  dailyStats: Array<{ date: string; total: number; success: number; failed: number }>
}

interface CreditSummary {
  totalSpent: number
  totalRecharged: number
  dailyStats: Array<{ date: string; spent: number; recharged: number }>
  typeStats: Record<string, number>
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: string | number
  sub?: string
  color: string
}) {
  return (
    <div className="fashion-glass rounded-2xl p-3 md:p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <span className="text-[11px] font-semibold text-[#b0a59a] tracking-wider uppercase">{label}</span>
      </div>
      <div className="text-[28px] font-bold text-[#2d2422] leading-none">{value}</div>
      {sub && <div className="text-[11px] text-[#b0a59a] mt-1.5">{sub}</div>}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const updateCredits = useAuthStore((state) => state.updateCredits)
  const credits = useAuthStore((s) => s.user?.credits ?? 0)
  const [logs, setLogs] = useState<CreditLog[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [creditPage, setCreditPage] = useState(1)
  const CREDIT_PAGE_SIZE = 10

  // 统计数据
  const [genStats, setGenStats] = useState<GenerationStats | null>(null)
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    void Promise.all([authApi.getMe(), workspaceApi.getBalance(), workspaceApi.getCreditHistory()])
      .then(([me, balance, history]) => {
        setUser(me)
        updateCredits(balance)
        setLogs(history.logs)
      })
      .catch((loadError) => setError(getErrorMessage(loadError, '加载个人中心失败')))
  }, [setUser, updateCredits])

  useEffect(() => {
    Promise.all([
      workspaceApi.getGenerationStats(),
      workspaceApi.getCreditSummary(),
    ])
      .then(([gen, cred]) => {
        setGenStats(gen as unknown as GenerationStats)
        setCreditSummary(cred)
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [])

  const handleCopyApiKey = () => {
    if (!user?.apiKey) return
    navigator.clipboard.writeText(user.apiKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const infoItems = [
    { label: '邮箱', value: user?.email, icon: Mail, color: '#c67b5c' },
    { label: '角色', value: user?.role === 'ADMIN' ? '管理员' : '客户', icon: Shield, color: '#8b7355' },
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
          className="hidden w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #8b7355 0%, #b0a59a 100%)' }}
        >
          <UserCircle className="w-4 h-4 text-white" />
        </div>
        <h1 className="hidden text-[18px] font-bold tracking-tight text-[#2d2422] flex-1">个人中心</h1>
      </div>
      <div className="hidden md:block mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #8b7355 0%, #b0a59a 100%)' }}
          >
            <UserCircle className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#2d2422]">个人中心</h1>
        </div>
        <p className="text-[13px] text-[#9b8e82] ml-[52px] tracking-wide">查看账号信息、数据统计与积分变动记录</p>
      </div>

      {error && (
        <div className="bg-[#fef2f0] text-[#c47070] px-5 py-3.5 rounded-2xl text-sm font-medium border border-[#f0d5d0]">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Account Info */}
        <div className="fashion-glass rounded-2xl p-4 md:p-6">
          <h2 className="text-[15px] font-semibold text-[#2d2422] mb-4">账号信息</h2>
          <div className="flex flex-col gap-3.5">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}12` }}
                >
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider">{item.label}</div>
                  <div className="text-[14px] font-medium text-[#2d2422]">{item.value}</div>
                </div>
              </div>
            ))}

            {/* ApiKey */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(125,155,118,0.1)' }}
              >
                <Key className="w-4 h-4 text-[#7d9b76]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider">API KEY</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-[12px] text-[#8b7355] bg-[rgba(139,115,85,0.04)] px-2 py-0.5 rounded-md font-mono truncate">
                    {user?.apiKey ?? '-'}
                  </code>
                  {user?.apiKey && (
                    <button
                      type="button"
                      className="p-1 rounded-md text-[#b0a59a] hover:text-[#c67b5c] hover:bg-[rgba(198,123,92,0.06)] transition-all flex-shrink-0"
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
          <h2 className="text-[15px] font-semibold text-[#2d2422] mb-4 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#d4a06a]" />
            使用提示
          </h2>
          <div className="flex flex-col gap-3">
            <div className="px-4 py-3 bg-[rgba(212,160,106,0.06)] border border-[rgba(212,160,106,0.12)] rounded-xl text-[13px] text-[#8b7355] leading-relaxed">
              生图功能使用你专属的 AI API Key，请联系管理员获取或配置。
            </div>
            <div className="px-4 py-3 bg-[rgba(125,155,118,0.06)] border border-[rgba(125,155,118,0.12)] rounded-xl text-[13px] text-[#5a7a53] leading-relaxed">
              若积分不足，请联系管理员为你充值。
            </div>
            <div className="px-4 py-3 bg-[rgba(198,123,92,0.06)] border border-[rgba(198,123,92,0.12)] rounded-xl text-[13px] text-[#b0654a] leading-relaxed">
              在工作台、模特工厂、AI 改款中生成的图片都会消耗积分，可在下方查看流水。
            </div>
            <button
              type="button"
              onClick={() => router.push('/tutorials')}
              className="flex items-center justify-between px-4 py-3 rounded-xl transition-all border"
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
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b7355, #b0a59a)' }}>
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-[13px] font-semibold text-[#2d2422]">使用教程</div>
                  <div className="text-[11px] text-[#b0a59a]">查看所有功能的详细操作指南</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#8b7355] flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>

      {/* 数据统计 */}
      <div className="fashion-glass rounded-2xl p-4 md:p-6">
        <h2 className="text-[15px] font-semibold text-[#2d2422] mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#c67b5c]" />
          数据统计
        </h2>
        {statsLoading ? (
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
              <div className="rounded-xl border border-[rgba(139,115,85,0.08)] bg-[rgba(139,115,85,0.02)] p-3 md:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-3.5 h-3.5 text-[#c67b5c]" />
                  <span className="text-[12px] font-semibold text-[#2d2422]">每日生图量</span>
                  <span className="text-[10px] text-[#c9bfb5] ml-auto">近14天</span>
                </div>
                <MiniBarChart data={dailyChartData} height={80} />
              </div>

              <div className="rounded-xl border border-[rgba(139,115,85,0.08)] bg-[rgba(139,115,85,0.02)] p-3 md:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Coins className="w-3.5 h-3.5 text-[#d4a06a]" />
                  <span className="text-[12px] font-semibold text-[#2d2422]">每日积分消耗</span>
                  <span className="text-[10px] text-[#c9bfb5] ml-auto">近14天</span>
                </div>
                <MiniBarChart data={creditChartData} height={80} barColor="#d4a06a" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Credit History */}
      <div className="fashion-glass rounded-2xl p-4 md:p-6">
        <h2 className="text-[15px] font-semibold text-[#2d2422] mb-4 flex items-center gap-2">
          <Coins className="w-4 h-4 text-[#d4a06a]" />
          积分记录
        </h2>
        {logs.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[#c9bfb5]">暂无积分变动记录</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider border-b border-[rgba(139,115,85,0.08)] bg-[rgba(139,115,85,0.02)]">变动</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider border-b border-[rgba(139,115,85,0.08)] bg-[rgba(139,115,85,0.02)]">余额</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider border-b border-[rgba(139,115,85,0.08)] bg-[rgba(139,115,85,0.02)]">原因</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider border-b border-[rgba(139,115,85,0.08)] bg-[rgba(139,115,85,0.02)]">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice((creditPage - 1) * CREDIT_PAGE_SIZE, creditPage * CREDIT_PAGE_SIZE).map((log) => (
                    <tr key={log.id} className="hover:bg-[rgba(139,115,85,0.02)] transition-colors">
                      <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)]">
                        <span className={`inline-flex items-center gap-1 font-semibold ${log.delta > 0 ? 'text-[#7d9b76]' : 'text-[#c47070]'}`}>
                          {log.delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                          {log.delta > 0 ? `+${log.delta}` : log.delta}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)] text-[#2d2422] font-medium">{log.balanceAfter}</td>
                      <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)] text-[#8b7355]">{log.reason}</td>
                      <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)] text-[#b0a59a]">{formatDateTime(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Math.ceil(logs.length / CREDIT_PAGE_SIZE) > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-[rgba(139,115,85,0.06)]">
                <span className="text-[12px] text-[#b0a59a]">共 {logs.length} 条记录</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditPage(p => Math.max(1, p - 1))}
                    disabled={creditPage === 1}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[rgba(139,115,85,0.06)]"
                  >
                    <ChevronLeft className="w-4 h-4 text-[#8b7355]" />
                  </button>
                  <span className="text-[12px] text-[#8b7355] tabular-nums min-w-[50px] text-center">{creditPage} / {Math.ceil(logs.length / CREDIT_PAGE_SIZE)}</span>
                  <button
                    type="button"
                    onClick={() => setCreditPage(p => Math.min(Math.ceil(logs.length / CREDIT_PAGE_SIZE), p + 1))}
                    disabled={creditPage >= Math.ceil(logs.length / CREDIT_PAGE_SIZE)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[rgba(139,115,85,0.06)]"
                  >
                    <ChevronRight className="w-4 h-4 text-[#8b7355]" />
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
