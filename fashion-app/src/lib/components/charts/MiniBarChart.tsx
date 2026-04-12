'use client'

interface BarItem {
  label: string
  value: number
  color?: string
}

interface MiniBarChartProps {
  data: BarItem[]
  height?: number
  barColor?: string
}

export function MiniBarChart({ data, height = 120, barColor = '#c67b5c' }: MiniBarChartProps) {
  if (data.length === 0) return <div className="text-[11px] text-[#c9bfb5] text-center py-6">暂无数据</div>

  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {data.map((item, i) => {
        const h = Math.max((item.value / max) * 100, 2)
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 group relative">
            <div
              className="w-full rounded-t-sm transition-all duration-300 group-hover:opacity-80"
              style={{
                height: `${h}%`,
                background: item.color || barColor,
                minHeight: '2px',
              }}
            />
            <span className="text-[8px] text-[#c9bfb5] truncate w-full text-center leading-none">
              {item.label}
            </span>
            {/* Tooltip */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#2d2422] text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {item.value}
            </div>
          </div>
        )
      })}
    </div>
  )
}
