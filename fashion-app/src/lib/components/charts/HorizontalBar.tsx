'use client'

interface HBarItem {
  label: string
  value: number
  color?: string
}

interface HorizontalBarProps {
  data: HBarItem[]
  maxItems?: number
  barColor?: string
}

export function HorizontalBar({ data, maxItems = 8, barColor = '#c67b5c' }: HorizontalBarProps) {
  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxItems)
  if (sorted.length === 0) return <div className="text-[11px] text-[#c9bfb5] text-center py-4">暂无数据</div>

  const max = Math.max(...sorted.map((d) => d.value), 1)

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((item, i) => {
        const pct = (item.value / max) * 100
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] text-[#8b7355] w-24 truncate flex-shrink-0 text-right">{item.label}</span>
            <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: 'rgba(139,115,85,0.04)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(pct, 3)}%`,
                  background: item.color || barColor,
                  opacity: 1 - i * 0.06,
                }}
              />
            </div>
            <span className="text-[11px] font-semibold text-[#2d2422] w-6 text-right">{item.value}</span>
          </div>
        )
      })}
    </div>
  )
}
