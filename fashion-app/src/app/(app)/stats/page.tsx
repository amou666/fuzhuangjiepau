'use client'

import { useEffect, useState } from 'react'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import { MiniBarChart } from '@/lib/components/charts/MiniBarChart'
import { DonutChart } from '@/lib/components/charts/DonutChart'
import { HorizontalBar } from '@/lib/components/charts/HorizontalBar'
import { BarChart3, Loader2, TrendingUp, Target, Coins, Zap, Image, Palette } from 'lucide-react'
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

const GENDER_LABELS: Record<string, string> = { female: '女性', male: '男性', androgynous: '中性' }
const BODY_LABELS: Record<string, string> = { petite: '娇小', slim: '修长', athletic: '匀称健美', average: '标准', curvy: '曲线', plus: '丰满', muscular: '肌肉型' }

function extractChinese(str: string): string {
  const m = str.match(/（(.+?)）/)
  return m ? m[1] : str.split('（')[0]
}

const DONUT_COLORS = ['#c67b5c', '#d4a882', '#8b7355', '#b0a59a', '#7d9b76', '#9bb07d']

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
    value: d.total,
  }))

  const creditChartData = [...creditDaily].reverse().slice(-14).map((d) => ({
    label: d.date.slice(5),
    value: d.spent,
    color: '#c67b5c',
  }))

  const taskDonutData = ov ? [
    { label: '成功', value: ov.successTasks, color: '#7d9b76' },
    { label: '失败', value: ov.failedTasks, color: '#c47070' },
    { label: '进行中', value: ov.pendingTasks, color: '#d4a06a' },
  ].filter((d) => d.value > 0) : []

  const poseData = Object.entries(genStats?.modelPreferences?.pose ?? {}).map(([k, v]) => ({
    label: extractChinese(k),
    value: v,
  }))

  const sceneData = Object.entries(genStats?.scenePreferences?.preset ?? {}).map(([k, v]) => ({
    label: extractChinese(k),
    value: v,
    color: '#7d9b76',
  }))

  const genderData = Object.entries(genStats?.modelPreferences?.gender ?? {}).map(([k, v], i) => ({
    label: GENDER_LABELS[k] || k,
    value: v,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }))

  const bodyData = Object.entries(genStats?.modelPreferences?.bodyType ?? {}).map(([k, v], i) => ({
    label: BODY_LABELS[k] || k,
    value: v,
    color: DONUT_COLORS[(i + 2) % DONUT_COLORS.length],
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

      {/* Task Status + Gender/Body Donuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="fashion-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-[#7d9b76]" />
            <span className="text-[13px] font-semibold text-[#2d2422]">任务状态分布</span>
          </div>
          <DonutChart data={taskDonutData} />
        </div>

        <div className="fashion-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-[#c67b5c]" />
            <span className="text-[13px] font-semibold text-[#2d2422]">性别偏好</span>
          </div>
          <DonutChart data={genderData} size={100} />
        </div>

        <div className="fashion-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-[#8b7355]" />
            <span className="text-[13px] font-semibold text-[#2d2422]">体型偏好</span>
          </div>
          <DonutChart data={bodyData} size={100} />
        </div>
      </div>

      {/* Preference Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="fashion-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#c67b5c]" />
            <span className="text-[13px] font-semibold text-[#2d2422]">常用姿势 TOP 8</span>
          </div>
          <HorizontalBar data={poseData} maxItems={8} />
        </div>

        <div className="fashion-glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[#7d9b76]" />
            <span className="text-[13px] font-semibold text-[#2d2422]">常用场景 TOP 8</span>
          </div>
          <HorizontalBar data={sceneData} maxItems={8} barColor="#7d9b76" />
        </div>
      </div>
    </div>
  )
}
