'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUploadPicker } from '@/lib/components/common/ImageUploadPicker'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { useDraftStore } from '@/lib/stores/draftStore'
import { useGenerationStore } from '@/lib/stores/generationStore'
import { getErrorMessage } from '@/lib/utils/api'
import {
  Palette, ChevronLeft, Download, Loader2, ImageIcon,
  GripVertical, Sun, Droplets, BookmarkPlus, Layers, Users,
  Pipette, Plus, X, Check, RotateCcw,
} from 'lucide-react'

// ─── 类型 ───

interface ColorReplacement {
  id: string
  sourceHex: string // 中间明度代表色
  sourceName: string // 色系名称，如"蓝色系"
  sourceHue: number // 色相角度 0-360
  sourceLightMin: number // 明度范围下限
  sourceLightMax: number // 明度范围上限
  sourceGradient: string[] // 5级渐变：暗→中→亮
  targetColor: { name: string; hex: string } | null
  clickX: number
  clickY: number
}

interface RecolorResult {
  url: string
  label: string
}

// ─── HSL ↔ HEX ───

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * Math.max(0, Math.min(1, color))).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { h: 0, s: 0, l: 50 }
  let r = parseInt(result[1], 16) / 255, g = parseInt(result[2], 16) / 255, b = parseInt(result[3], 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) { case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break; case g: h = ((b - r) / d + 2) / 6; break; case b: h = ((r - g) / d + 4) / 6; break }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function getColorName(hex: string): string {
  const { h, s, l } = hexToHsl(hex)
  if (l < 10) return '黑色'
  if (l > 92) return '白色'
  if (s < 8) { if (l < 30) return '深灰'; if (l < 60) return '中灰'; return '浅灰' }
  const hueNames: [number, string][] = [[0,'红色'],[15,'橙红'],[30,'橙色'],[45,'橙黄'],[60,'黄色'],[80,'黄绿'],[120,'绿色'],[150,'青绿'],[180,'青色'],[200,'天蓝'],[220,'蓝色'],[260,'靛蓝'],[280,'紫色'],[310,'紫红'],[340,'玫红'],[360,'红色']]
  let hueName = '红色'
  for (const [t, n] of hueNames) { if (h >= t) hueName = n }
  let prefix = ''
  if (l < 30) prefix = '深'; else if (l > 70) prefix = '浅'
  if (s < 40) prefix += '灰'
  return `${prefix}${hueName}`
}

// 根据色相获取色系名称（用于色域替换）
function getHueFamilyName(hue: number, saturation: number): string {
  if (saturation < 8) return '灰色系'
  const hueNames: [number, string][] = [[0,'红色系'],[15,'橙红系'],[30,'橙色系'],[45,'橙黄系'],[60,'黄色系'],[80,'黄绿系'],[120,'绿色系'],[150,'青绿系'],[180,'青色系'],[200,'天蓝系'],[220,'蓝色系'],[260,'靛蓝系'],[280,'紫色系'],[310,'紫红系'],[340,'玫红系'],[360,'红色系']]
  let name = '红色系'
  for (const [t, n] of hueNames) { if (hue >= t) name = n }
  return name
}

// 色相环上两角度的最短距离（0~180）
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b)
  return d > 180 ? 360 - d : d
}

// HSV → HSL（SV面板用HSV，显示用HSL）
function hsvToHsl(h: number, s: number, v: number): { h: number; s: number; l: number } {
  const sv = s / 100, vv = v / 100
  const l = vv * (1 - sv / 2)
  const sl = l === 0 || l === 1 ? 0 : (vv - l) / Math.min(l, 1 - l)
  return { h, s: Math.round(sl * 100), l: Math.round(l * 100) }
}

// HSL → HSV
function hslToHsv(h: number, s: number, l: number): { h: number; s: number; v: number } {
  const sl = s / 100, ll = l / 100
  const v = ll + sl * Math.min(ll, 1 - ll)
  const sv = v === 0 ? 0 : 2 * (1 - ll / v)
  return { h, s: Math.round(sv * 100), v: Math.round(v * 100) }
}

// ─── 预设色 ───

const PRESET_COLORS = [
  { name: '奶白', hex: '#F5F0E8' }, { name: '米色', hex: '#E8DCC8' },
  { name: '浅灰', hex: '#C8C2B8' }, { name: '深灰', hex: '#6B6560' },
  { name: '炭黑', hex: '#2C2824' }, { name: '纯黑', hex: '#1A1A1A' },
  { name: '驼色', hex: '#C4A882' }, { name: '焦糖', hex: '#C67B5C' },
  { name: '锈红', hex: '#A0522D' }, { name: '砖红', hex: '#8B4513' },
  { name: '卡其', hex: '#BDB76B' }, { name: '奶茶', hex: '#D4A882' },
  { name: '雾蓝', hex: '#7B9EB0' }, { name: '藏青', hex: '#1B3A5C' },
  { name: '松绿', hex: '#2E5E4E' }, { name: '丁香紫', hex: '#9B8AA0' },
  { name: '冰川灰', hex: '#A3B5C0' }, { name: '雾霾蓝', hex: '#6D8EA0' },
  { name: '珊瑚橙', hex: '#E8785A' }, { name: '柠檬黄', hex: '#E8D44D' },
  { name: '薄荷绿', hex: '#7BC5A0' }, { name: '玫红', hex: '#C44569' },
  { name: '酒红', hex: '#722F37' }, { name: '宝蓝', hex: '#1E3F66' },
]

// ─── 对比滑块 ───

function CompareSlider({ imgA, imgB }: { imgA: string; imgB: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50)
  const dragging = useRef(false)
  const updatePos = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)))
  }, [])

  return (
    <div ref={containerRef} className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden cursor-col-resize select-none touch-none"
      onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); updatePos(e.clientX) }}
      onPointerMove={(e) => { if (dragging.current) updatePos(e.clientX) }}
      onPointerUp={() => { dragging.current = false }}>
      <img src={imgB} alt="改色" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img src={imgA} alt="原图" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      </div>
      <div className="absolute top-0 bottom-0 w-[3px] bg-[var(--bg-card)] shadow-lg z-10" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-[var(--bg-card)] rounded-full shadow-xl flex items-center justify-center">
          <GripVertical className="w-3.5 h-3.5 text-[#6366f1]" />
        </div>
      </div>
      <div className="absolute top-2 left-2 bg-black/50 text-white text-[9px] font-bold px-2 py-0.5 rounded-full z-10">原图</div>
      <div className="absolute top-2 right-2 bg-[#6366f1]/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full z-10">改色</div>
    </div>
  )
}

// ─── 目标色选择弹窗 ───

function TargetColorPicker({
  currentHex,
  onConfirm,
  onClose,
}: {
  currentHex: string | null
  onConfirm: (color: { name: string; hex: string }) => void
  onClose: () => void
}) {
  // 内部用 HSV 存储（SV 面板天然是 HSV 空间）
  const [hsv, setHsv] = useState({ h: 15, s: 80, v: 95 })
  const [hexInput, setHexInput] = useState('#C67B5C')
  const panelRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const panelDragging = useRef(false)
  const barDragging = useRef(false)

  // HSV → HSL → HEX 用于显示
  const currentComputedHex = useMemo(() => {
    const hsl = hsvToHsl(hsv.h, hsv.s, hsv.v)
    return hslToHex(hsl.h, hsl.s, hsl.l)
  }, [hsv])

  // 初始化时从 currentHex 解析
  useEffect(() => {
    if (currentHex) {
      const hsl = hexToHsl(currentHex)
      const hsv = hslToHsv(hsl.h, hsl.s, hsl.l)
      setHsv(hsv)
      setHexInput(currentHex.toUpperCase())
    }
  }, [currentHex])

  // SV 面板交互（HSV 空间：X=饱和度, Y=明度）
  const updateSV = useCallback((clientX: number, clientY: number) => {
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    const s = Math.round(Math.max(0, Math.min(clientX - rect.left, rect.width)) / rect.width * 100)
    const v = Math.round(100 - Math.max(0, Math.min(clientY - rect.top, rect.height)) / rect.height * 100)
    setHsv(prev => ({ ...prev, s, v }))
    const hsl = hsvToHsl(hsv.h, s, v)
    setHexInput(hslToHex(hsl.h, hsl.s, hsl.l))
  }, [hsv.h])

  const updateHue = useCallback((clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return
    const h = Math.round(Math.max(0, Math.min(clientX - rect.left, rect.width)) / rect.width * 360)
    setHsv(prev => ({ ...prev, h }))
    const hsl = hsvToHsl(h, hsv.s, hsv.v)
    setHexInput(hslToHex(hsl.h, hsl.s, hsl.l))
  }, [hsv.s, hsv.v])

  return (
    <div>
      {/* SV 面板 */}
      <div className="max-w-[260px] mx-auto">
        <div
          ref={panelRef}
          className="relative w-full aspect-square rounded-2xl cursor-crosshair select-none touch-none overflow-hidden"
          style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))` }}
          onPointerDown={(e) => { panelDragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); updateSV(e.clientX, e.clientY) }}
          onPointerMove={(e) => { if (panelDragging.current) updateSV(e.clientX, e.clientY) }}
          onPointerUp={() => { panelDragging.current = false }}
        >
          <div className="absolute w-6 h-6 rounded-full border-[3px] border-white shadow-lg"
            style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, transform: 'translate(-50%, -50%)', backgroundColor: currentComputedHex }} />
        </div>
      </div>

      {/* 色相条 */}
      <div ref={barRef}
        className="relative w-full h-5 rounded-full cursor-crosshair select-none touch-none mt-4"
        style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
        onPointerDown={(e) => { barDragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); updateHue(e.clientX) }}
        onPointerMove={(e) => { if (barDragging.current) updateHue(e.clientX) }}
        onPointerUp={() => { barDragging.current = false }}
      >
        <div className="absolute top-1/2 w-6 h-6 rounded-full border-[3px] border-white shadow-lg"
          style={{ left: `${(hsv.h / 360) * 100}%`, transform: 'translate(-50%, -50%)', backgroundColor: hslToHex(hsv.h, 100, 50) }} />
      </div>

      {/* HEX + 按钮 */}
      <div className="flex items-center gap-2 mt-4">
        <div className="w-9 h-9 rounded-2xl border border-white shadow-sm flex-shrink-0" style={{ backgroundColor: currentComputedHex }} />
        <input type="text" value={hexInput} onChange={(e) => {
          setHexInput(e.target.value)
          const c = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
          if (/^#[0-9a-fA-F]{6}$/.test(c)) {
            const hsl = hexToHsl(c)
            setHsv(hslToHsv(hsl.h, hsl.s, hsl.l))
          }
        }} className="w-[88px] px-2.5 py-2 rounded-2xl text-[13px] font-mono outline-none flex-shrink-0"
          style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-normal)' }} maxLength={7} />
        <div className="flex-1" />
        <button type="button" onClick={onClose}
          className="px-4 py-2.5 rounded-2xl text-[13px] text-[var(--text-quaternary)] hover:bg-[var(--bg-active)] active:bg-[rgba(139,115,85,0.12)] flex-shrink-0">
          取消
        </button>
        <button type="button" onClick={() => onConfirm({ name: getColorName(currentComputedHex), hex: currentComputedHex.toUpperCase() })}
          className="px-5 py-2.5 rounded-2xl text-[13px] font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          确认
        </button>
      </div>

      {/* 快捷色 */}
      <div className="mt-4">
        <div className="text-[11px] text-[var(--text-quaternary)] mb-2">快捷选色</div>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_COLORS.map(c => (
            <button key={c.hex} type="button" onClick={() => {
              const hsl = hexToHsl(c.hex)
              const hsvFromHsl = hslToHsv(hsl.h, hsl.s, hsl.l)
              setHsv(hsvFromHsl)
              setHexInput(c.hex.toUpperCase())
            }}
              className="flex items-center gap-1.5 px-2 py-2 rounded-2xl text-[11px] font-medium hover:bg-[var(--bg-active)] active:bg-[rgba(139,115,85,0.12)] transition-colors"
              style={{ border: '1px solid var(--border-light)' }}>
              <span className="w-4 h-4 rounded-full flex-shrink-0 border border-[var(--border-light)] shadow-sm" style={{ backgroundColor: c.hex }} />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 标记点覆盖层（独立组件，安全使用 getBoundingClientRect） ───

function MarkerOverlay({ imageContainerRef, imgRef, replacements }: {
  imageContainerRef: React.RefObject<HTMLDivElement | null>
  imgRef: React.RefObject<HTMLImageElement | null>
  replacements: ColorReplacement[]
}) {
  const [positions, setPositions] = useState<Array<{ left: string; top: string }>>([])

  useLayoutEffect(() => {
    const container = imageContainerRef.current
    const img = imgRef.current
    if (!container || !img || !img.naturalWidth) {
      setPositions(replacements.map(() => ({ left: '50%', top: '50%' })))
      return
    }

    const cr = container.getBoundingClientRect()
    const ir = img.naturalWidth / img.naturalHeight
    const ctr = cr.width / cr.height
    let imgLeft: number, imgTop: number, imgWidth: number, imgHeight: number
    if (ir > ctr) {
      imgWidth = cr.width; imgHeight = cr.width / ir; imgLeft = 0; imgTop = (cr.height - imgHeight) / 2
    } else {
      imgHeight = cr.height; imgWidth = cr.height * ir; imgLeft = (cr.width - imgWidth) / 2; imgTop = 0
    }

    setPositions(replacements.map(rep => ({
      left: `${imgLeft + rep.clickX / 100 * imgWidth}px`,
      top: `${imgTop + rep.clickY / 100 * imgHeight}px`,
    })))
  }, [replacements, imageContainerRef, imgRef])

  return (
    <>
      {replacements.map((rep, i) => (
        <div
          key={rep.id}
          className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          style={{ left: positions[i]?.left ?? '50%', top: positions[i]?.top ?? '50%' }}
        >
          <div className="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${rep.sourceGradient[0]}, ${rep.sourceGradient[2]}, ${rep.sourceGradient[4]})`,
            }}>
            <div className="w-2 h-2 rounded-full bg-white/80" />
          </div>
        </div>
      ))}
    </>
  )
}

// ─── 主页面 ───

export default function RecolorContent() {
  const router = useRouter()
  const updateCredits = useAuthStore((state) => state.updateCredits)
  const addNotification = useNotificationStore((state) => state.add)
  const credits = useAuthStore((s) => s.user?.credits ?? 0)
  const creditsLow = credits < 1
  const quickDraft = useDraftStore((state) => state.quickWorkspaceDraft)
  const setQuickDraft = useDraftStore((state) => state.setQuickWorkspaceDraft)

  const [imageUrl, setImageUrl] = useState('')

  // 核心状态：颜色替换列表
  const [replacements, setReplacements] = useState<ColorReplacement[]>([])
  const [editingId, setEditingId] = useState<string | null>(null) // 正在编辑目标色的项

  // 取色模式
  const [pickMode, setPickMode] = useState(true) // 默认开启取色模式
  const [hoverColor, setHoverColor] = useState<string | null>(null) // 鼠标悬停位置的颜色

  // 微调
  const [brightness, setBrightness] = useState(0)
  const [saturation, setSaturation] = useState(0)

  // 生成
  const genState = useGenerationStore((s) => s.recolor)
  const setGen = useGenerationStore((s) => s.setRecolorGen)
  const { submitting, progress, results, error } = genState
  const [compareMode, setCompareMode] = useState(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [applyTarget, setApplyTarget] = useState<'clothing' | 'clothingBack' | 'model' | 'scene' | null>(null)

  // Canvas 用于取色
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  // 图片加载后绘制到 canvas
  useEffect(() => {
    if (!imageUrl) { imgRef.current = null; return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) ctx.drawImage(img, 0, 0)
    }
    img.src = imageUrl
  }, [imageUrl])

  // 从 canvas 区域采样 → 提取色相 + 明度范围 + 渐变
  const sampleHueFromCanvas = useCallback((clientX: number, clientY: number): {
    hue: number; saturation: number; lightMin: number; lightMax: number;
    representativeHex: string; gradient: string[]; familyName: string;
  } | null => {
    const canvas = canvasRef.current
    const container = imageContainerRef.current
    const img = imgRef.current
    if (!canvas || !container || !img) return null

    const rect = container.getBoundingClientRect()
    const containerW = rect.width
    const containerH = rect.height
    const imgRatio = img.naturalWidth / img.naturalHeight
    const containerRatio = containerW / containerH

    let renderW, renderH, offsetX, offsetY
    if (imgRatio > containerRatio) {
      renderW = containerW; renderH = containerW / imgRatio; offsetX = 0; offsetY = (containerH - renderH) / 2
    } else {
      renderH = containerH; renderW = containerH * imgRatio; offsetX = (containerW - renderW) / 2; offsetY = 0
    }

    const px = clientX - rect.left - offsetX
    const py = clientY - rect.top - offsetY
    if (px < 0 || py < 0 || px > renderW || py > renderH) return null

    const imgX = Math.round((px / renderW) * img.naturalWidth)
    const imgY = Math.round((py / renderH) * img.naturalHeight)

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null

    // 采样 40×40 区域
    const sampleSize = 40
    const halfSize = Math.floor(sampleSize / 2)
    const sx = Math.max(0, imgX - halfSize)
    const sy = Math.max(0, imgY - halfSize)
    const sw = Math.min(sampleSize, img.naturalWidth - sx)
    const sh = Math.min(sampleSize, img.naturalHeight - sy)

    const imageData = ctx.getImageData(sx, sy, sw, sh)
    const pixels = imageData.data

    // 收集有效像素的色相和明度
    const hues: number[] = []
    const sats: number[] = []
    const lights: number[] = []

    // 收集所有像素的 HSL
    const allPixels: { h: number; s: number; l: number }[] = []
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const l = (max + min) / 2
      // 排除纯黑（不是布料）
      if (l < 0.08) continue
      let h = 0, s = 0
      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
          case g: h = ((b - r) / d + 2) / 6; break
          case b: h = ((r - g) / d + 4) / 6; break
        }
      }
      // 白色/浅灰：饱和度和明度都低，放宽过滤
      const isLightGray = l > 0.75 && s < 0.20
      // 正常颜色：排除低饱和度（灰色不是布料色相）和过曝高光
      if (!isLightGray && (s < 0.15 || l > 0.92)) continue
      allPixels.push({ h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) })
    }

    // 先取点击位置的精确像素，用于判断是否是白色/灰色
    const centerPixel = ctx.getImageData(imgX, imgY, 1, 1).data
    const centerHex = `#${centerPixel[0].toString(16).padStart(2, '0')}${centerPixel[1].toString(16).padStart(2, '0')}${centerPixel[2].toString(16).padStart(2, '0')}`
    const centerHsl = hexToHsl(centerHex)

    // 白色/浅灰特殊处理：不采样区域，直接用点击位置的色值
    // 只有饱和度真正很低（<20）且明度高，才算灰/白色；高明度彩色保留其色相
    if (centerHsl.s < 12 || (centerHsl.l > 92 && centerHsl.s < 25)) {
      const isWhite = centerHsl.l > 95
      const familyName = isWhite ? '白色' : '浅灰色'
      const lightMin = Math.max(centerHsl.l - 10, 85)
      const lightMax = Math.min(centerHsl.l + 5, 100)
      const gradient = generateGradient(centerHsl.h, centerHsl.s, lightMin, lightMax)
      return {
        hue: centerHsl.h, saturation: centerHsl.s, lightMin, lightMax,
        representativeHex: centerHex.toUpperCase(), gradient, familyName,
      }
    }

    if (allPixels.length < 5) {
      // 有效像素太少，退回单像素取色
      const gradient = generateGradient(centerHsl.h, centerHsl.s, Math.max(centerHsl.l - 20, 10), Math.min(centerHsl.l + 20, 85))
      return {
        hue: centerHsl.h, saturation: centerHsl.s, lightMin: Math.max(centerHsl.l - 20, 10), lightMax: Math.min(centerHsl.l + 20, 85),
        representativeHex: centerHex.toUpperCase(), gradient, familyName: getHueFamilyName(centerHsl.h, centerHsl.s),
      }
    }

    // Step 1: 用"中间明度 + 足够饱和度"像素计算主导色相 — 避开高光、阴影、低饱和灰/棕色
    const midTonePixels = allPixels.filter(p => p.l >= 20 && p.l <= 70 && p.s >= 15)
    const hueSourcePixels = midTonePixels.length >= 5 ? midTonePixels : allPixels.filter(p => p.l >= 15 && p.l <= 80 && p.s >= 10)

    // 如果还是没有足够像素，用全部
    const finalHueSource = hueSourcePixels.length >= 3 ? hueSourcePixels : allPixels

    // 圆形均值法计算主导色相
    let sinSum = 0, cosSum = 0
    for (const p of finalHueSource) {
      sinSum += Math.sin((p.h * Math.PI) / 180)
      cosSum += Math.cos((p.h * Math.PI) / 180)
    }
    let dominantHue = 0
    if (sinSum !== 0 || cosSum !== 0) {
      dominantHue = Math.round((Math.atan2(sinSum, cosSum) * 180) / Math.PI)
      if (dominantHue < 0) dominantHue += 360
    }

    // Step 2: 过滤 — 只保留与主导色相接近的像素（容差 ±25°）
    const matchedPixels = allPixels.filter(p => hueDistance(p.h, dominantHue) <= 25)
    const finalPixels = matchedPixels.length >= 3 ? matchedPixels : allPixels

    // Step 3: 计算明度范围 — 用百分位数而非 min/max，避免极端值
    const matchedLights = finalPixels.map(p => p.l).sort((a, b) => a - b)
    const matchedSats = finalPixels.map(p => p.s)

    const p10 = matchedLights[Math.max(0, Math.floor(matchedLights.length * 0.1))]
    const p90 = matchedLights[Math.min(matchedLights.length - 1, Math.floor(matchedLights.length * 0.9))]
    const lightMin = matchedLights.length > 0 ? Math.max(p10, 5) : 20
    const lightMax = matchedLights.length > 0 ? Math.min(p90, 95) : 80

    // 饱和度取中位数，避免极端值
    const sortedSats = [...matchedSats].sort((a, b) => a - b)
    const medianSat = sortedSats.length > 0 ? sortedSats[Math.floor(sortedSats.length / 2)] : 50

    // 代表色：用中间明度 + 中位饱和度
    const midLight = Math.round((lightMin + lightMax) / 2)
    const representativeHex = hslToHex(dominantHue, medianSat, midLight)
    const gradient = generateGradient(dominantHue, medianSat, lightMin, lightMax)

    return {
      hue: dominantHue, saturation: medianSat, lightMin, lightMax,
      representativeHex: representativeHex.toUpperCase(), gradient,
      familyName: getHueFamilyName(dominantHue, medianSat),
    }
  }, [])

  // 生成 N 级渐变（暗→中→亮）
  function generateGradient(hue: number, sat: number, lightMin: number, lightMax: number, steps: number = 5): string[] {
    const result: string[] = []
    for (let i = 0; i < steps; i++) {
      const l = lightMin + (lightMax - lightMin) * (i / (steps - 1))
      result.push(hslToHex(hue, sat, Math.round(l)))
    }
    return result
  }

  // 点击图片取色
  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if (!pickMode) return
    const sample = sampleHueFromCanvas(e.clientX, e.clientY)
    if (!sample) return

    const container = imageContainerRef.current
    const img = imgRef.current
    const rect = container?.getBoundingClientRect()
    if (!rect || !img) return

    // 计算实际渲染图片的位置（object-contain 居中）
    const containerW = rect.width
    const containerH = rect.height
    const imgRatio = img.naturalWidth / img.naturalHeight
    const containerRatio = containerW / containerH
    let renderW, renderH, offsetX, offsetY
    if (imgRatio > containerRatio) {
      renderW = containerW; renderH = containerW / imgRatio; offsetX = 0; offsetY = (containerH - renderH) / 2
    } else {
      renderH = containerH; renderW = containerH * imgRatio; offsetX = (containerW - renderW) / 2; offsetY = 0
    }

    // 标记点位置相对于实际渲染图片
    const relX = ((e.clientX - rect.left - offsetX) / renderW * 100)
    const relY = ((e.clientY - rect.top - offsetY) / renderH * 100)

    setReplacements(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceHex: sample.representativeHex,
      sourceName: sample.familyName,
      sourceHue: sample.hue,
      sourceLightMin: sample.lightMin,
      sourceLightMax: sample.lightMax,
      sourceGradient: sample.gradient,
      targetColor: null,
      clickX: relX,
      clickY: relY,
    }])
  }, [pickMode, sampleHueFromCanvas])

  // 鼠标移动时预览颜色
  const handleImageMouseMove = useCallback((e: React.MouseEvent) => {
    if (!pickMode) { setHoverColor(null); return }
    // 单像素取色用于预览
    const canvas = canvasRef.current
    const container = imageContainerRef.current
    const img = imgRef.current
    if (!canvas || !container || !img) return
    const rect = container.getBoundingClientRect()
    const containerW = rect.width, containerH = rect.height
    const imgRatio = img.naturalWidth / img.naturalHeight
    const containerRatio = containerW / containerH
    let renderW, renderH, offsetX, offsetY
    if (imgRatio > containerRatio) { renderW = containerW; renderH = containerW / imgRatio; offsetX = 0; offsetY = (containerH - renderH) / 2 }
    else { renderH = containerH; renderW = containerH * imgRatio; offsetX = (containerW - renderW) / 2; offsetY = 0 }
    const px = e.clientX - rect.left - offsetX, py = e.clientY - rect.top - offsetY
    if (px < 0 || py < 0 || px > renderW || py > renderH) { setHoverColor(null); return }
    const imgX = Math.round((px / renderW) * img.naturalWidth), imgY = Math.round((py / renderH) * img.naturalHeight)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const pixel = ctx.getImageData(imgX, imgY, 1, 1).data
    const hex = `#${pixel[0].toString(16).padStart(2, '0')}${pixel[1].toString(16).padStart(2, '0')}${pixel[2].toString(16).padStart(2, '0')}`
    setHoverColor(hex)
  }, [pickMode])

  // 移除颜色替换
  const removeReplacement = (id: string) => {
    setReplacements(prev => prev.filter(r => r.id !== id))
    if (editingId === id) setEditingId(null)
  }

  // 设置目标色
  const setTargetColor = (id: string, color: { name: string; hex: string }) => {
    setReplacements(prev => prev.map(r => r.id === id ? { ...r, targetColor: color } : r))
    setEditingId(null)
  }

  // 生成
  const canGenerate = imageUrl && replacements.length > 0 && replacements.every(r => r.targetColor) && !creditsLow

  const handleGenerate = async () => {
    if (!canGenerate) return
    setGen({ submitting: true, error: '', results: [] })

    const colorMappings = replacements.map(r => ({
      sourceHex: r.sourceHex,
      sourceName: r.sourceName,
      sourceHue: r.sourceHue,
      sourceLightMin: r.sourceLightMin,
      sourceLightMax: r.sourceLightMax,
      sourceGradient: r.sourceGradient,
      targetName: r.targetColor!.name,
      targetHex: r.targetColor!.hex,
    }))

    setGen({ progress: '正在生成改色图...' })
    try {
      const data = await workspaceApi.recolorByColor(imageUrl, colorMappings, { brightness, saturation })
      const label = replacements.map(r => `${r.sourceName}→${r.targetColor!.name}`).join(' + ')
      setGen({ results: [{ url: data.resultUrl, label }] })
      updateCredits(data.credits)
      addNotification({ type: 'success', message: '改色完成！' })
    } catch (err) {
      setGen({ error: getErrorMessage(err, '改色生成失败') })
      // 失败时同步积分（后端可能已退还）
      void workspaceApi.getBalance().then(updateCredits).catch(() => undefined)
    }
    setGen({ submitting: false, progress: '' })
  }

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `recolor-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[var(--bg-page)] overflow-hidden">
      {/* Hidden canvas for color picking */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 顶部导航 */}
      <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3"
        style={{ background: 'var(--bg-sidebar)' }}>
        <button type="button" onClick={() => router.push('/tools')} className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,115,85,0.06)' }}>
          <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
        <div className="w-8 h-8 rounded-2xl hidden md:flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          <Palette className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[14px] font-bold tracking-tight text-[var(--text-primary)]">AI 改色</h1>
          <p className="hidden md:block text-[11px] text-[var(--text-tertiary)] truncate">点击衣服取色 → 选择目标色 → AI 色系替换（保留明暗层次）</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1280px] mx-auto">
          {!imageUrl ? (
            /* ─── 上传状态 ─── */
            <div className="max-w-lg mx-auto">
              <div className="fashion-glass rounded-2xl p-8 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(99,102,241,0.08)' }}>
                  <Pipette className="w-7 h-7 text-[#6366f1]" />
                </div>
                <h3 className="text-[17px] font-bold text-[var(--text-primary)] mb-2">AI 改色工具</h3>
                <p className="text-[13px] text-[var(--text-tertiary)] mb-5">上传服装图片，点击衣服取色，AI 识别色系并保留明暗层次精准换色</p>
                <ImageUploadPicker label="服装原图" value={imageUrl} onChange={setImageUrl} sourceType="clothing" />
              </div>
            </div>
          ) : (
            /* ─── 工作区 ─── */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* 左侧：大图 + 取色 */}
              <div className="lg:col-span-7 space-y-4">
                {/* 大图卡片（含顶部控制栏） */}
                <div className="fashion-glass rounded-2xl overflow-hidden">
                  {/* 顶部控制栏 */}
                  <div className="flex items-center justify-between p-3 md:p-4 border-b border-[var(--border-light)]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPickMode(!pickMode)}
                        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl text-[11px] sm:text-[12px] font-semibold transition-all"
                        style={{
                          background: pickMode ? 'rgba(99,102,241,0.1)' : 'rgba(139,115,85,0.04)',
                          border: pickMode ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(139,115,85,0.08)',
                          color: pickMode ? '#6366f1' : 'var(--text-secondary)',
                        }}
                      >
                        <Pipette className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="hidden sm:inline">{pickMode ? '取色模式（点击图片取色）' : '取色模式已关闭'}</span>
                        <span className="sm:hidden">{pickMode ? '取色中' : '已关闭'}</span>
                      </button>
                      {hoverColor && pickMode && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-light)' }}>
                          <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: hoverColor }} />
                          <span className="text-[11px] font-mono text-[#5a4a3a]">{hoverColor.toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => { setImageUrl(''); setReplacements([]); setGen({ results: [], error: '' }); setCompareMode(false); setPreviewSrc(null); }} className="text-[11px] text-[var(--text-quaternary)] hover:text-[#c47070] transition-colors flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> 换图片
                    </button>
                  </div>

                  {/* 图片区域 */}
                  <div
                    ref={imageContainerRef}
                    className={`relative ${pickMode ? 'cursor-crosshair' : 'cursor-default'}`}
                    onClick={handleImageClick}
                    onMouseMove={handleImageMouseMove}
                    onMouseLeave={() => setHoverColor(null)}
                  >
                    {/* 标记点定位层 — 精确覆盖在渲染图片上 */}
                    {replacements.length > 0 && (
                      <MarkerOverlay
                        imageContainerRef={imageContainerRef}
                        imgRef={imgRef}
                        replacements={replacements}
                      />
                    )}
                    <img
                      src={imageUrl}
                      alt="服装原图"
                      className="w-full max-h-[65vh] object-contain block"
                      draggable={false}
                    />
                    {/* 取色提示 */}
                    {pickMode && replacements.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-black/40 text-white text-[13px] font-semibold px-5 py-2.5 rounded-2xl backdrop-blur-sm">
                          👆 点击衣服上的颜色来取色
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 改色结果 — 放在原图下方，同等大小 */}
                {results.length > 0 && (
                  <div className="fashion-glass rounded-2xl overflow-hidden hover:shadow-[0_4px_16px_rgba(99,102,241,0.12)] transition-all">
                    {/* 颜色替换映射 — 仅色块，无文字 */}
                    <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-light)]">
                      {replacements.map((rep) => (
                        <div key={rep.id} className="flex items-center gap-1">
                          <div className="w-3.5 h-3.5 rounded-full border border-white/80 shadow-sm flex-shrink-0" style={{ background: rep.sourceGradient[2] }} title={rep.sourceName} />
                          <span className="text-[10px] text-[var(--text-quaternary)]">→</span>
                          <div className="w-3.5 h-3.5 rounded-full border border-white/80 shadow-sm flex-shrink-0" style={{ backgroundColor: rep.targetColor?.hex || '#ccc' }} title={rep.targetColor?.name || '未选'} />
                        </div>
                      ))}
                    </div>
                    {compareMode ? (
                      <CompareSlider imgA={imageUrl} imgB={results[0].url} />
                    ) : (
                      <div className="relative cursor-pointer" onClick={() => setPreviewSrc(results[0].url)}>
                        <img src={results[0].url} alt="改色" className="w-full max-h-[65vh] object-contain block" />
                        <div className="absolute bottom-3 left-3 bg-[#6366f1]/80 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">{results[0].label}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* 结果操作栏 */}
                {results.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-2xl text-[11px] font-medium transition-colors ${compareMode ? 'bg-[#6366f1] text-white' : 'text-[var(--text-quaternary)] hover:bg-[rgba(99,102,241,0.06)] hover:text-[#6366f1]'}`}
                      onClick={() => setCompareMode(!compareMode)}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                      {compareMode ? '退出对比' : '原图对比'}
                    </button>
                    <button className="p-1.5 rounded hover:bg-[rgba(99,102,241,0.06)] text-[var(--text-quaternary)] hover:text-[#6366f1]" onClick={() => handleDownload(results[0].url)}>
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-[rgba(99,102,241,0.06)] text-[var(--text-quaternary)] hover:text-[#6366f1]"
                      onClick={async () => {
                        try {
                          await workspaceApi.createFavorite({ type: 'clothing', name: `改色-${results[0].label}`, data: { source: 'recolor', imageUrl } as unknown as Record<string, unknown>, previewUrl: results[0].url })
                          addNotification({ type: 'success', message: '已存入素材库' })
                        } catch { addNotification({ type: 'error', message: '存入素材库失败' }) }
                      }}>
                      <BookmarkPlus className="w-3.5 h-3.5" />
                    </button>
                    <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-2xl text-[11px] font-medium text-[var(--text-quaternary)] hover:bg-[rgba(99,102,241,0.06)] hover:text-[#6366f1] transition-colors"
                      onClick={() => setApplyTarget('clothing')}>
                      <Layers className="w-3.5 h-3.5" /> 应用到工作台
                    </button>
                  </div>
                )}
              </div>

              {/* 右侧：颜色替换列表 + 操作 */}
              <div className="lg:col-span-5 space-y-4">
                {/* 颜色替换列表 */}
                <div className="fashion-glass rounded-2xl p-4 md:p-5">
                  <h3 className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2 mb-3 pb-3 border-b border-[var(--border-light)]">
                    <Palette className="w-4 h-4 text-[#6366f1]" /> 颜色替换方案
                  </h3>

                  {replacements.length === 0 ? (
                    <div className="py-8 text-center">
                      <Pipette className="w-8 h-8 text-[var(--text-quaternary)] mx-auto mb-2" style={{ opacity: 0.4 }} />
                      <p className="text-[13px] text-[var(--text-quaternary)]">点击左侧衣服取色</p>
                      <p className="text-[11px] text-[var(--text-extreme)] mt-1">取色后选择目标色系</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {replacements.map((rep) => (
                        <div key={rep.id} className="rounded-2xl p-3 transition-all"
                          style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-light)' }}>
                          {/* 源色 → 目标色 — 小屏换行 */}
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                            {/* 源色 — 渐变色条 */}
                            <div className="flex items-center gap-2 flex-1 min-w-0 basis-[40%] sm:basis-auto">
                              <div
                                className="w-8 h-7 sm:w-10 sm:h-8 rounded-2xl border-2 border-white shadow-md flex-shrink-0"
                                style={{
                                  background: `linear-gradient(to right, ${rep.sourceGradient[0]}, ${rep.sourceGradient[1]}, ${rep.sourceGradient[2]}, ${rep.sourceGradient[3]}, ${rep.sourceGradient[4]})`,
                                }}
                              />
                              <div className="min-w-0">
                                <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{rep.sourceName}</div>
                              </div>
                            </div>

                            {/* 箭头 */}
                            <span className="text-[14px] text-[var(--text-quaternary)] flex-shrink-0">→</span>

                            {/* 目标色 */}
                            <div className="flex-1 min-w-0 basis-[40%] sm:basis-auto">
                              {rep.targetColor ? (
                                <div className="flex items-center gap-2 cursor-pointer group"
                                  onClick={() => setEditingId(editingId === rep.id ? null : rep.id)}>
                                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-2xl border-2 border-white shadow-md flex-shrink-0 ring-2 ring-transparent group-hover:ring-[#6366f1]/30 group-active:ring-[#6366f1]/50 transition-all"
                                    style={{ backgroundColor: rep.targetColor.hex }} />
                                  <div className="min-w-0">
                                    <div className="text-[12px] font-semibold text-[#6366f1] truncate">{rep.targetColor.name}</div>
                                    <div className="text-[10px] font-mono text-[var(--text-quaternary)]">{rep.targetColor.hex}</div>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" onClick={() => setEditingId(rep.id)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-semibold text-[#6366f1] w-full justify-center"
                                  style={{ border: '1.5px dashed rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
                                  <Plus className="w-3 h-3" /> 选择目标色
                                </button>
                              )}
                            </div>

                            {/* 删除 */}
                            <button type="button" onClick={() => removeReplacement(rep.id)}
                              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[rgba(196,112,112,0.1)] active:bg-[rgba(196,112,112,0.2)] flex-shrink-0">
                              <X className="w-3.5 h-3.5 text-[#c47070]" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 添加更多颜色提示 */}
                  {replacements.length > 0 && replacements.length < 5 && pickMode && (
                    <div className="mt-3 text-center text-[11px] text-[var(--text-quaternary)]">
                      继续点击衣服添加更多颜色替换
                    </div>
                  )}
                </div>

                {/* 微调 */}
                <div className="fashion-glass rounded-2xl p-4">
                  <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-3">微调</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-[#5a4a3a] flex items-center gap-1"><Sun className="w-3 h-3" /> 明度</span>
                        <span className="text-[11px] font-bold text-[#6366f1]">{brightness > 0 ? '+' : ''}{brightness}%</span>
                      </div>
                      <input type="range" min="-30" max="30" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))}
                        className="w-full h-1 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#6366f1' }} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-[#5a4a3a] flex items-center gap-1"><Droplets className="w-3 h-3" /> 饱和度</span>
                        <span className="text-[11px] font-bold text-[#6366f1]">{saturation > 0 ? '+' : ''}{saturation}%</span>
                      </div>
                      <input type="range" min="-30" max="30" value={saturation} onChange={(e) => setSaturation(parseInt(e.target.value))}
                        className="w-full h-1 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#6366f1' }} />
                    </div>
                  </div>
                </div>

                {/* 生成按钮 */}
                <button
                  className="flex flex-col items-center justify-center w-full py-4 text-white border-none rounded-2xl text-sm font-bold cursor-pointer transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate || submitting || creditsLow}
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{progress || '生成中...'}</span>
                    </div>
                  ) : (
                    <>
                      <div>开始改色</div>
                      <div className="text-[11px] font-normal opacity-85 mt-1">
                        {creditsLow ? '积分不足，无法改色' : `消耗 1 积分 · ${replacements.length > 0 ? replacements.map(r => `${r.sourceName}→${r.targetColor?.name || '?'}`).join(' · ') : '请先取色'}`}
                      </div>
                    </>
                  )}
                </button>

                {error && <div className="bg-[rgba(196,112,112,0.08)] text-[#c47070] px-4 py-3 rounded-2xl text-[12px] font-medium border border-[rgba(196,112,112,0.2)]">{error}</div>}

              </div>
            </div>
          )}
        </div>
      </div>

      {/* 颜色选择器底部弹出面板 */}
      {editingId && (() => {
        const rep = replacements.find(r => r.id === editingId)
        if (!rep) return null
        return (
          <div
            className="fixed inset-0 z-[300] flex items-end justify-center"
            onClick={() => setEditingId(null)}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-lg bg-[var(--bg-card)] rounded-t-2xl shadow-[0_-4px_32px_rgba(0,0,0,0.15)] z-10 animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: '85vh', overflowY: 'auto' }}
            >
              {/* 拖拽条 */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-9 h-1 rounded-full bg-[#d4cfc8]" />
              </div>
              <div className="px-4 pb-5">
                <TargetColorPicker
                  currentHex={rep.sourceHex}
                  onConfirm={(color) => setTargetColor(rep.id, color)}
                  onClose={() => setEditingId(null)}
                />
              </div>
            </div>
          </div>
        )
      })()}

      {/* 应用到工作台 - 选择目标弹窗 */}
      {applyTarget && results.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[350] p-6" onClick={() => setApplyTarget(null)}>
          <div className="relative max-w-[360px] w-full bg-white/95 backdrop-blur-[40px] rounded-2xl border border-white/80 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">应用到工作台</h3>
            <p className="text-[13px] text-[var(--text-tertiary)] mb-5">选择改色结果图在工作台中的用途</p>
            <div className="flex flex-col gap-2.5">
              {([
                { key: 'clothing', label: '服装正面', desc: '作为工作台的服装主视图', icon: ImageIcon },
                { key: 'clothingBack', label: '服装反面', desc: '作为工作台的服装背面图', icon: ImageIcon },
                { key: 'model', label: '模特', desc: '作为工作台的模特参考图', icon: Users },
                { key: 'scene', label: '场景', desc: '作为工作台的场景图', icon: Layers },
              ] as const).map(opt => {
                const OptIcon = opt.icon
                return (
                  <button key={opt.key} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left"
                    style={{ borderColor: 'var(--border-normal)', background: 'var(--bg-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.12)'; e.currentTarget.style.background = 'rgba(139,115,85,0.03)'; }}
                    onClick={() => {
                      const url = results[0].url
                      const qw = useDraftStore.getState().qw
                      const existing = useDraftStore.getState().quickWorkspaceDraft
                      const patch: Record<string, string> = {}
                      if (opt.key === 'clothing') patch.clothingUrl = url
                      else if (opt.key === 'clothingBack') patch.clothingBackUrl = url
                      else if (opt.key === 'model') patch.modelImageUrl = url
                      else if (opt.key === 'scene') patch.sceneImageUrl = url
                      setQuickDraft({
                        mode: existing?.mode || qw.mode || 'background',
                        clothingUrl: existing?.clothingUrl || qw.clothingUrl || '',
                        clothingBackUrl: existing?.clothingBackUrl || qw.clothingBackUrl || '',
                        modelImageUrl: existing?.modelImageUrl || qw.modelImageUrl || '',
                        sceneImageUrl: existing?.sceneImageUrl || qw.sceneImageUrl || '',
                        extraPrompt: existing?.extraPrompt || qw.extraPrompt || '',
                        aspectRatio: existing?.aspectRatio || qw.aspectRatio || '3:4',
                        framing: existing?.framing || qw.framing || 'auto',
                        device: existing?.device || qw.device || 'phone',
                        ...patch,
                      })
                      setApplyTarget(null)
                      addNotification({ type: 'success', message: `已应用到工作台（${opt.label}），正在跳转...` })
                      router.push('/quick-workspace')
                    }}>
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.08)' }}>
                      <OptIcon className="w-4 h-4 text-[#6366f1]" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--text-primary)]">{opt.label}</div>
                      <div className="text-[11px] text-[var(--text-tertiary)]">{opt.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            <button className="w-full mt-4 py-2.5 rounded-2xl text-[13px] font-medium bg-[var(--bg-muted)] text-[var(--text-secondary)] border border-[var(--border-light)] hover:bg-[var(--bg-active)] transition-all"
              onClick={() => setApplyTarget(null)}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      {previewSrc && (
        <div onClick={() => setPreviewSrc(null)} className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[9999] cursor-pointer">
          <div className="relative bg-[var(--bg-card)] rounded-sm shadow-[0_8px_40px_rgba(0,0,0,0.45)] cursor-default" style={{ padding: '14px 14px 56px 14px' }} onClick={(e) => e.stopPropagation()}>
            <img src={previewSrc} alt="预览" className="max-w-[85vw] max-h-[75vh] object-contain" />
            <button className="absolute -top-2 -right-2 w-8 h-8 bg-[var(--bg-card)] shadow-lg text-[#666] border-none rounded-full flex items-center justify-center cursor-pointer hover:text-[#333] z-10"
              onClick={() => setPreviewSrc(null)}>✕</button>
            <button className="absolute -bottom-2 -right-2 w-9 h-9 bg-[var(--bg-card)] shadow-lg text-[#6366f1] border-none rounded-full flex items-center justify-center cursor-pointer z-10"
              onClick={() => handleDownload(previewSrc)}>
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
