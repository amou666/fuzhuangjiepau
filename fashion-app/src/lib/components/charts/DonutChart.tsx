'use client'

interface DonutItem {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  data: DonutItem[]
  size?: number
}

export function DonutChart({ data, size = 120 }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return <div className="text-[11px] text-[#c9bfb5] text-center py-6">暂无数据</div>

  const r = 42
  const cx = 50
  const cy = 50
  const circumference = 2 * Math.PI * r

  let offset = 0
  const segments = data.map((item) => {
    const pct = item.value / total
    const dash = pct * circumference
    const seg = { ...item, pct, dash, offset }
    offset += dash
    return seg
  })

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 100 100" className="flex-shrink-0">
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="12"
            strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
            strokeDashoffset={-seg.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="transition-all duration-500"
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="text-[18px] font-bold" fill="#2d2422">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="text-[8px]" fill="#b0a59a">总计</text>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: seg.color }} />
            <span className="text-[11px] text-[#8b7355] truncate">{seg.label}</span>
            <span className="text-[11px] font-semibold text-[#2d2422] ml-auto">{seg.value}</span>
            <span className="text-[9px] text-[#c9bfb5]">{(seg.pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
