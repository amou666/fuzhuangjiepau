'use client'

import Link from 'next/link'
import { Drama, Wand2, Sparkles, FileText, Palette, Box } from 'lucide-react'

const TOOLS = [
  {
    id: 'ghost-mannequin',
    title: '一键3D图',
    description: '上传样衣拍摄图，AI 自动生成隐形模特专业产品图',
    icon: Box,
    href: '/tools/ghost-mannequin',
    gradientFrom: '#c67b5c',
    gradientTo: '#d4a882',
  },
  {
    id: 'model-fusion',
    title: '模特工厂',
    description: '通过参数描述或多张参考图，生成全新的 AI 模特形象',
    icon: Drama,
    href: '/model-fusion',
    gradientFrom: '#ec4899',
    gradientTo: '#f43f5e',
  },
  {
    id: 'recolor',
    title: 'AI 改色',
    description: '自由选色，局部改色，明度饱和度微调，视觉色卡精准换色',
    icon: Palette,
    href: '/recolor',
    gradientFrom: '#6366f1',
    gradientTo: '#8b5cf6',
  },
  {
    id: 'production-sheet',
    title: '生产单',
    description: '上传服装图片，AI 自动识别款式信息和 S 码尺寸，生成全码规格单',
    icon: FileText,
    href: '/production-sheet',
    gradientFrom: '#8b7355',
    gradientTo: '#c67b5c',
  },
]

export default function ToolsPage() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="md:hidden flex items-center gap-2.5 -mb-2">
        <div
          className="hidden w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #8b7355 0%, #c67b5c 100%)' }}
        >
          <Wand2 className="w-4 h-4 text-white" />
        </div>
        <h1 className="hidden text-lg font-bold tracking-tight text-[var(--text-primary)] flex-1">工具</h1>
      </div>
      <div className="hidden md:block mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #8b7355 0%, #c67b5c 100%)' }}
          >
            <Wand2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">工具</h1>
        </div>
        <p className="text-sm text-[var(--text-tertiary)] ml-[52px] tracking-wide">AI 辅助工具集合，提升你的创作效率</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
        {TOOLS.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.id}
              href={tool.href}
              prefetch={true}
              className="group fashion-glass rounded-2xl p-4 md:p-6 text-left transition-all hover:shadow-[0_4px_16px_rgba(198,123,92,0.12)] active:scale-[0.98]"
            >
              <div
                className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${tool.gradientFrom}, ${tool.gradientTo})` }}
              >
                <Icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
              </div>
              <h3 className="text-base md:text-sm font-bold text-[var(--text-primary)] mb-1.5">{tool.title}</h3>
              <p className="text-xs md:text-xs text-[var(--text-tertiary)] leading-relaxed">{tool.description}</p>
            </Link>
          )
        })}
      </div>

      {/* 更多工具占位 */}
      <div className="fashion-glass rounded-2xl p-8 md:p-12 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(139,115,85,0.06)' }}>
          <Sparkles className="w-6 h-6 text-[var(--text-quaternary)]" style={{ opacity: 0.5 }} />
        </div>
        <h3 className="text-sm font-semibold text-[var(--text-quaternary)] mb-1">更多工具即将上线</h3>
        <p className="text-xs text-[var(--text-extreme)]">我们正在开发更多 AI 辅助工具，敬请期待</p>
      </div>
    </div>
  )
}
