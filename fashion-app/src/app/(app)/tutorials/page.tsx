'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TUTORIAL_MODULES, type TutorialModule } from '@/lib/tutorials'
import { ChevronDown, BookOpen, ExternalLink } from 'lucide-react'

function TutorialCard({ module }: { module: TutorialModule }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="fashion-glass rounded-2xl overflow-hidden transition-all"
      style={{
        boxShadow: expanded ? `0 4px 24px ${module.color}18` : 'none',
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 md:gap-4 p-4 md:p-5 text-left transition-colors hover:bg-[rgba(139,115,85,0.02)]"
      >
        <div
          className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${module.color}, ${module.color}cc)` }}
        >
          {module.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] md:text-[15px] font-bold text-[#2d2422]">{module.title}</h3>
          <p className="text-[12px] text-[#9b8e82] mt-0.5 line-clamp-1">{module.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] text-[#b0a59a] hidden sm:inline">
            {module.steps.length} 步教程
          </span>
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-300"
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              background: 'rgba(139,115,85,0.04)',
            }}
          >
            <ChevronDown className="w-4 h-4 text-[#8b7355]" />
          </div>
        </div>
      </button>

      {/* Steps */}
      {expanded && (
        <div className="px-4 pb-4 md:px-5 md:pb-5 border-t border-[rgba(139,115,85,0.06)]">
          <div className="flex flex-col gap-3 pt-4">
            {module.steps.map((step, idx) => (
              <div
                key={idx}
                className="flex gap-3 md:gap-4"
                style={{ animation: `fade-up 0.35s ease-out ${idx * 0.06}s both` }}
              >
                {/* Step number */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-[12px] font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${module.color}, ${module.color}cc)` }}
                  >
                    {idx + 1}
                  </div>
                  {idx < module.steps.length - 1 && (
                    <div className="w-px flex-1 mt-1.5 mb-1.5" style={{ background: `${module.color}20` }} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-1">
                  <h4 className="text-[13px] font-semibold text-[#2d2422] mb-1.5">{step.title}</h4>
                  <p className="text-[12px] text-[#6b5d4f] leading-relaxed whitespace-pre-line">
                    {step.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function TutorialsPage() {
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-2.5 -mb-1">
        <div
          className="hidden w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #8b7355 0%, #b0a59a 100%)' }}
        >
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <h1 className="hidden text-[18px] font-bold tracking-tight text-[#2d2422]">使用教程</h1>
      </div>

      {/* Desktop header */}
      <div className="hidden md:block mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #8b7355 0%, #b0a59a 100%)' }}
          >
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#2d2422]">使用教程</h1>
        </div>
        <p className="text-[13px] text-[#9b8e82] ml-[52px] tracking-wide">
          点击展开各功能模块，查看详细操作步骤与使用技巧
        </p>
      </div>

      {/* Tutorial modules */}
      <div className="flex flex-col gap-3 md:gap-4">
        {TUTORIAL_MODULES.map((module) => (
          <TutorialCard key={module.key} module={module} />
        ))}
      </div>
    </div>
  )
}
