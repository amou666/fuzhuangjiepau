'use client'

import { useEffect, useState } from 'react'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import { MiniBarChart } from '@/lib/components/charts/MiniBarChart'
import { BarChart3, Loader2, TrendingUp, Target, Coins, Zap, Image } from 'lucide-react'
import { TutorialButton } from '@/lib/components/common/TutorialModal'
import { TUTORIALS } from '@/lib/tutorials'

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
    <div className="fashion-glass rounded-2xl p-5">
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

export default function StatsPage() {
  const credits = useAuthStore((s) => s.user?.credits ?? 0)
  const [genStats, setGenStats] = useState<GenerationStats | null>(null)
  const [creditStats, setCreditStats] = useState<CreditSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      workspaceApi.getGenerationStats(),
      workspaceApi.getCreditSummary(),
    ])
      .then(([gen, cred]) => {
        setGenStats(gen as unknown as GenerationStats)
        setCreditStats(cred)
      })
      .catch((err) => setError(err?.message || '加载统计数据失败，请刷新重试'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="fashion-glass rounded-2xl p-12 text-center">
        <Loader2 className="w-7 h-7 text-[#c67b5c] animate-spin mx-auto mb-4" />
        <p className="text-[13px] text-[#9b8e82]">加载统计数据...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fashion-glass rounded-2xl p-12 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(196,112,112,0.08)' }}>
          <BarChart3 className="w-6 h-6 text-[#c47070]" />
        </div>
        <h3 className="text-[15px] font-semibold text-[#c47070] mb-2">加载失败</h3>
        <p className="text-[13px] text-[#b0a59a] mb-4">{error}</p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
          onClick={() => window.location.reload()}
        >
          重新加载
        </button>
      </div>
    )
  }

  const ov = genStats?.overview
  const daily = genStats?.dailyStats ?? []
  const creditDaily = creditStats?.dailyStats ?? []

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
    <div className="flex flex-col gap-6">
      <div className="md:hidden flex items-center gap-2.5 -mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)' }}
        >
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-[18px] font-bold tracking-tight text-[#2d2422] flex-1">数据统计</h1>
        <TutorialButton id="stats" steps={TUTORIALS.stats} />
      </div>
      {/* Header */}
      <div className="hidden md:block mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)' }}
          >
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#2d2422]">数据统计</h1>
          <div className="ml-auto"><TutorialButton id="stats" steps={TUTORIALS.stats} /></div>
        </div>
        <p className="text-[13px] text-[#9b8e82] ml-[52px] tracking-wide">查看你的生图数据、积分消耗和使用偏好</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Image} label="总生图" value={ov?.totalTasks ?? 0} sub={`成功率 ${ov?.successRate ?? 0}%`} color="#c67b5c" />
        <StatCard icon={Target} label="成功" value={ov?.successTasks ?? 0} sub={`失败 ${ov?.failedTasks ?? 0}`} color="#7d9b76" />
        <StatCard icon={Coins} label="总消耗" value={creditStats?.totalSpent ?? 0} sub={`充值 ${creditStats?.totalRecharged ?? 0}`} color="#d4a06a" />
        <StatCard icon={Zap} label="当前积分" value={credits} sub="可用余额" color="#8b7355" />
      </div>

      {/* Daily Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="fashion-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[#c67b5c]" />
            <span className="text-[13px] font-semibold text-[#2d2422]">每日生图量</span>
            <span className="text-[10px] text-[#c9bfb5] ml-auto">近14天</span>
          </div>
          <MiniBarChart data={dailyChartData} height={100} />
        </div>

        <div className="fashion-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="w-4 h-4 text-[#d4a06a]" />
            <span className="text-[13px] font-semibold text-[#2d2422]">每日积分消耗</span>
            <span className="text-[10px] text-[#c9bfb5] ml-auto">近14天</span>
          </div>
          <MiniBarChart data={creditChartData} height={100} barColor="#d4a06a" />
        </div>
      </div>


    </div>
  )
}
