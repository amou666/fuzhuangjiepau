'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, X, Check } from 'lucide-react'

// ─── HSL ↔ HEX 工具函数 ───

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * Math.max(0, Math.min(1, color)))
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { h: 0, s: 0, l: 50 }
  let r = parseInt(result[1], 16) / 255
  let g = parseInt(result[2], 16) / 255
  let b = parseInt(result[3], 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

// ─── 预设快捷色 ───

const PRESET_COLORS = [
  // 经典中性色
  { name: '奶白', hex: '#F5F0E8' },
  { name: '米色', hex: '#E8DCC8' },
  { name: '浅灰', hex: '#C8C2B8' },
  { name: '深灰', hex: '#6B6560' },
  { name: '炭黑', hex: '#2C2824' },
  { name: '纯黑', hex: '#1A1A1A' },
  // 大地暖色
  { name: '驼色', hex: '#C4A882' },
  { name: '焦糖', hex: '#C67B5C' },
  { name: '锈红', hex: '#A0522D' },
  { name: '砖红', hex: '#8B4513' },
  { name: '卡其', hex: '#BDB76B' },
  { name: '奶茶', hex: '#D4A882' },
  // 冷调色系
  { name: '雾蓝', hex: '#7B9EB0' },
  { name: '藏青', hex: '#1B3A5C' },
  { name: '松绿', hex: '#2E5E4E' },
  { name: '丁香紫', hex: '#9B8AA0' },
  { name: '冰川灰', hex: '#A3B5C0' },
  { name: '雾霾蓝', hex: '#6D8EA0' },
  // 亮色/流行
  { name: '珊瑚橙', hex: '#E8785A' },
  { name: '柠檬黄', hex: '#E8D44D' },
  { name: '薄荷绿', hex: '#7BC5A0' },
  { name: '玫红', hex: '#C44569' },
  { name: '酒红', hex: '#722F37' },
  { name: '宝蓝', hex: '#1E3F66' },
]

interface SelectedColor {
  name: string
  hex: string
}

interface ColorPickerProps {
  selectedColors: SelectedColor[]
  onColorsChange: (colors: SelectedColor[]) => void
  maxColors?: number
  aiRecommendColors?: SelectedColor[]
}

// ─── 色相条组件 ───

function HueBar({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  const barRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updateHue = useCallback((clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    onChange(Math.round((x / rect.width) * 360))
  }, [onChange])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updateHue(e.clientX)
  }, [updateHue])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    updateHue(e.clientX)
  }, [updateHue])

  const onPointerUp = useCallback(() => { dragging.current = false }, [])

  return (
    <div
      ref={barRef}
      className="relative w-full h-4 rounded-full cursor-crosshair select-none touch-none"
      style={{
        background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg"
        style={{
          left: `${(hue / 360) * 100}%`,
          transform: 'translate(-50%, -50%)',
          backgroundColor: hslToHex(hue, 100, 50),
        }}
      />
    </div>
  )
}

// ─── SV 面板组件 ───

function SVPanel({ hue, saturation, lightness, onChange }: {
  hue: number
  saturation: number
  lightness: number
  onChange: (s: number, l: number) => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updateSV = useCallback((clientX: number, clientY: number) => {
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height))
    const s = Math.round((x / rect.width) * 100)
    const l = Math.round(100 - (y / rect.height) * 100)
    onChange(s, l)
  }, [onChange])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    updateSV(e.clientX, e.clientY)
  }, [updateSV])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    updateSV(e.clientX, e.clientY)
  }, [updateSV])

  const onPointerUp = useCallback(() => { dragging.current = false }, [])

  return (
    <div
      ref={panelRef}
      className="relative w-full aspect-square rounded-xl cursor-crosshair select-none touch-none overflow-hidden"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg"
        style={{
          left: `${saturation}%`,
          top: `${100 - lightness}%`,
          transform: 'translate(-50%, -50%)',
          backgroundColor: hslToHex(hue, saturation, lightness),
        }}
      />
    </div>
  )
}

// ─── 主组件 ───

export function ColorPicker({ selectedColors, onColorsChange, maxColors = 6, aiRecommendColors }: ColorPickerProps) {
  const [currentHsl, setCurrentHsl] = useState({ h: 15, s: 60, l: 50 })
  const [hexInput, setHexInput] = useState('#C67B5C')
  const [showPresets, setShowPresets] = useState(true)

  const currentHex = hslToHex(currentHsl.h, currentHsl.s, currentHsl.l)

  const handleHslChange = useCallback((h: number, s: number, l: number) => {
    setCurrentHsl({ h, s, l })
    setHexInput(hslToHex(h, s, l))
  }, [])

  const handleHexInput = useCallback((value: string) => {
    setHexInput(value)
    const clean = value.startsWith('#') ? value : `#${value}`
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      const hsl = hexToHsl(clean)
      setCurrentHsl(hsl)
    }
  }, [])

  const addCurrentColor = useCallback(() => {
    if (selectedColors.length >= maxColors) return
    const name = getColorName(currentHex)
    if (selectedColors.some(c => c.hex.toLowerCase() === currentHex.toLowerCase())) return
    onColorsChange([...selectedColors, { name, hex: currentHex.toUpperCase() }])
  }, [currentHex, selectedColors, onColorsChange, maxColors])

  const addPresetColor = useCallback((hex: string, name: string) => {
    if (selectedColors.length >= maxColors) return
    if (selectedColors.some(c => c.hex.toLowerCase() === hex.toLowerCase())) return
    onColorsChange([...selectedColors, { name, hex: hex.toUpperCase() }])
  }, [selectedColors, onColorsChange, maxColors])

  const removeColor = useCallback((index: number) => {
    onColorsChange(selectedColors.filter((_, i) => i !== index))
  }, [selectedColors, onColorsChange])

  return (
    <div className="flex flex-col gap-4">
      {/* SV 面板 */}
      <SVPanel
        hue={currentHsl.h}
        saturation={currentHsl.s}
        lightness={currentHsl.l}
        onChange={(s, l) => handleHslChange(currentHsl.h, s, l)}
      />

      {/* 色相条 */}
      <HueBar
        hue={currentHsl.h}
        onChange={(h) => handleHslChange(h, currentHsl.s, currentHsl.l)}
      />

      {/* 当前色预览 + HEX 输入 + 添加按钮 */}
      <div className="flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-xl border-2 border-white shadow-md flex-shrink-0"
          style={{ backgroundColor: currentHex }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexInput(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl text-[13px] font-mono text-[#2d2422] outline-none"
          style={{ background: 'rgba(139,115,85,0.04)', border: '1px solid rgba(139,115,85,0.12)' }}
          placeholder="#C67B5C"
          maxLength={7}
        />
        <button
          type="button"
          onClick={addCurrentColor}
          disabled={selectedColors.length >= maxColors || selectedColors.some(c => c.hex.toLowerCase() === currentHex.toLowerCase())}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] font-semibold text-white transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          <Plus className="w-3.5 h-3.5" /> 添加
        </button>
      </div>

      {/* AI 推荐色 */}
      {aiRecommendColors && aiRecommendColors.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px] font-bold text-[#6366f1]">✨ AI 推荐色</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aiRecommendColors.map((c, i) => (
              <button
                key={`ai-${i}`}
                type="button"
                onClick={() => addPresetColor(c.hex, c.name)}
                disabled={selectedColors.some(sc => sc.hex.toLowerCase() === c.hex.toLowerCase()) || selectedColors.length >= maxColors}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 hover:scale-105"
                style={{
                  background: 'rgba(99,102,241,0.06)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  color: '#4338ca',
                }}
              >
                <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.hex }} />
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 快捷预设色 */}
      <div>
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-[#9b8e82]"
        >
          <span>{showPresets ? '▼' : '▶'}</span> 快捷色卡
        </button>
        {showPresets && (
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => addPresetColor(c.hex, c.name)}
                disabled={selectedColors.some(sc => sc.hex.toLowerCase() === c.hex.toLowerCase()) || selectedColors.length >= maxColors}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-40 hover:scale-105"
                style={{
                  background: 'rgba(139,115,85,0.04)',
                  border: '1px solid rgba(139,115,85,0.1)',
                  color: '#5a4a3a',
                }}
              >
                <span className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white/50" style={{ backgroundColor: c.hex }} />
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 已选颜色列表 */}
      {selectedColors.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px] font-bold text-[#2d2422]">已选颜色</span>
            <span className="text-[10px] text-[#b0a59a]">({selectedColors.length}/{maxColors})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedColors.map((c, i) => (
              <div
                key={`sel-${i}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                style={{
                  background: 'rgba(99,102,241,0.06)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  color: '#4338ca',
                }}
              >
                <span className="w-4 h-4 rounded-lg flex-shrink-0 border border-white shadow-sm" style={{ backgroundColor: c.hex }} />
                <span>{c.name}</span>
                <button
                  type="button"
                  onClick={() => removeColor(i)}
                  className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-[rgba(196,112,112,0.15)] transition-colors"
                >
                  <X className="w-2.5 h-2.5 text-[#c47070]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 颜色命名工具 ───

function getColorName(hex: string): string {
  const { h, s, l } = hexToHsl(hex)
  if (l < 10) return '黑色'
  if (l > 92) return '白色'
  if (s < 8) {
    if (l < 30) return '深灰'
    if (l < 60) return '中灰'
    return '浅灰'
  }
  const hueNames: [number, string][] = [
    [0, '红色'], [15, '橙红'], [30, '橙色'], [45, '橙黄'],
    [60, '黄色'], [80, '黄绿'], [120, '绿色'], [150, '青绿'],
    [180, '青色'], [200, '天蓝'], [220, '蓝色'], [260, '靛蓝'],
    [280, '紫色'], [310, '紫红'], [340, '玫红'], [360, '红色'],
  ]
  let hueName = '红色'
  for (const [threshold, name] of hueNames) {
    if (h >= threshold) hueName = name
  }
  let prefix = ''
  if (l < 30) prefix = '深'
  else if (l > 70) prefix = '浅'
  if (s < 40) prefix += '灰'
  return `${prefix}${hueName}`
}
