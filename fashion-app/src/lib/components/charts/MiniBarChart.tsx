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
  if (data.length === 0) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-extreme)', textAlign: 'center', padding: '24px 0' }}>
        暂无数据
      </div>
    )
  }

  if (data.every((d) => d.value === 0)) {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-extreme)', textAlign: 'center', padding: '24px 0' }}>
        暂无数据
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 3,
        height,
      }}
    >
      {data.map((item, i) => {
        const h = Math.max((item.value / max) * height, 4)
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              minWidth: 0,
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '100%',
                borderRadius: '2px 2px 0 0',
                height: h,
                background: item.color || barColor,
                minHeight: 4,
                transition: 'all 0.3s',
              }}
            />
            <span
              style={{
                fontSize: 8,
                color: 'var(--text-extreme)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%',
                textAlign: 'center',
                lineHeight: 1,
              }}
            >
              {item.label}
            </span>
            {/* Tooltip */}
            <div
              className="mini-bar-tooltip"
              style={{
                position: 'absolute',
                top: -24,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--text-primary)',
                color: '#fff',
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                opacity: 0,
                transition: 'opacity 0.2s',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              {item.value}
            </div>
          </div>
        )
      })}
    </div>
  )
}
