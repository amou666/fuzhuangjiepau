'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUploadPicker } from '@/lib/components/common/ImageUploadPicker'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { getErrorMessage } from '@/lib/utils/api'
import { useGenerationStore } from '@/lib/stores/generationStore'
import { ChevronLeft, FileText, RefreshCw, Layers, Scissors, CheckCircle2, Image as ImageIcon, Download, ArrowLeft, AlertCircle, Loader2, History, Trash2, Clock, BookmarkPlus } from 'lucide-react'

interface SpecRow {
  size: string
  length: number
  chest: number
  shoulder: number
  sleeve: number
  bottom: number
}

interface ProductData {
  name: string
  material: string
  accessories: string
  date: string
  specs: SpecRow[]
}

const INITIAL_SPECS: SpecRow[] = [
  { size: 'S', length: 0, chest: 0, shoulder: 0, sleeve: 0, bottom: 0 },
  { size: 'M', length: 0, chest: 0, shoulder: 0, sleeve: 0, bottom: 0 },
  { size: 'L', length: 0, chest: 0, shoulder: 0, sleeve: 0, bottom: 0 },
  { size: 'XL', length: 0, chest: 0, shoulder: 0, sleeve: 0, bottom: 0 },
]

// ─── 历史记录 ───
interface HistoryRecord {
  id: string
  imageUrl: string
  productData: ProductData
  createdAt: number
}

const HISTORY_KEY = 'production-sheet-history'
const MAX_HISTORY = 50

function loadHistory(): HistoryRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const records: HistoryRecord[] = raw ? JSON.parse(raw) : []
    // 清理超过30天的记录
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    return records.filter(r => r.createdAt > thirtyDaysAgo)
  } catch { return [] }
}

function saveHistory(records: HistoryRecord[]) {
  if (typeof window === 'undefined') return
  // TODO: 迁移到服务端存储，当前仅存 localStorage，换设备/清缓存会丢失
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, MAX_HISTORY)))
}

const processGrading = (baseS: Omit<SpecRow, 'size'>): SpecRow[] => {
  const sizes = ['S', 'M', 'L', 'XL'] as const
  const grading = { chest: 2, shoulder: 2, sleeve: 1, bottom: 2 }

  return sizes.map((size, index) => {
    // S 码为 0 时，其他尺码也为 0
    const length = baseS.length === 0 ? 0 : (() => {
      if (index === 1) return baseS.length + 1
      if (index === 2) return baseS.length + 2
      if (index === 3) return baseS.length + 4
      return baseS.length
    })()

    return {
      size,
      length,
      chest: baseS.chest === 0 ? 0 : baseS.chest + (index * grading.chest),
      shoulder: baseS.shoulder === 0 ? 0 : baseS.shoulder + (index * grading.shoulder),
      sleeve: baseS.sleeve === 0 ? 0 : baseS.sleeve + (index * grading.sleeve),
      bottom: baseS.bottom === 0 ? 0 : baseS.bottom + (index * grading.bottom),
    }
  })
}

/** HTML 转义，防止 XSS */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** 生成纯内联样式的导出 HTML（给 html2canvas 截图用，避免 Tailwind CSS 变量解析问题） */
function buildExportHtml(data: ProductData, imgUrl: string): string {
  const rows = [
    { label: '衣长 Body Length', key: 'length' as const },
    { label: '胸宽 1/2 Chest', key: 'chest' as const },
    { label: '肩宽 Shoulder', key: 'shoulder' as const },
    { label: '袖长 Sleeve Length', key: 'sleeve' as const },
    { label: '下摆 1/2 Bottom', key: 'bottom' as const },
  ]

  const thStyle = 'padding:12px 8px;text-align:center;font-weight:800;font-size:17px;width:80px'
  const tdLabelStyle = 'padding:12px 16px 12px 0;font-weight:700;font-size:17px;color:#2d2422'
  const tdValueStyle = 'padding:12px 8px;text-align:center;font-weight:800;font-size:17px;color:#6b5d4f'

  return `
<div style="width:1200px;min-height:780px;background:#fff;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <!-- 顶部标题栏 -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 32px 20px 32px;background:#2d2422;color:#fff">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#c67b5c,#d4a882)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
      </div>
      <div>
        <div style="font-size:20px;font-weight:700;letter-spacing:-0.01em">生产单</div>
      </div>
    </div>
    <div style="font-size:14px;opacity:0.9;font-weight:800;letter-spacing:0.1em;color:#fff">${escapeHtml(data.date)}</div>
  </div>

  <!-- 主体：左图右表 -->
  <div style="display:flex;flex:1">
    <!-- 左：样照 -->
    <div style="width:400px;flex-shrink:0;padding:32px 24px 32px 32px;display:flex;align-items:flex-start">
      <div style="width:100%;border-radius:2px;overflow:hidden;border:1px solid #e5e0d8;box-shadow:0 2px 12px #f7f5f2">
        <img src="${escapeHtml(imgUrl)}" alt="Garment" style="width:100%;height:auto;display:block" crossorigin="anonymous" />
      </div>
    </div>

    <!-- 右：尺寸表 -->
    <div style="flex:1;padding:32px 40px 16px 0">
      <table style="width:100%;border-collapse:collapse;color:#2d2422">
        <thead>
          <tr style="border-bottom:2px solid #2d2422">
            <th style="padding:12px 16px 12px 0;text-align:left;font-size:14px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;opacity:0.6;width:220px">测量部位 Measure Point</th>
            ${data.specs.map(s => `<th style="${thStyle}">${s.size}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, idx) => `
          <tr style="${idx < 4 ? 'border-bottom:1px solid #f2efe9' : ''}">
            <td style="${tdLabelStyle}">${row.label}</td>
            ${data.specs.map(s => `<td style="${tdValueStyle}">${s[row.key]}</td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>

      <!-- 联动说明 -->
      <div style="margin-top:24px;display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:8px;background:#fbf5f1;border:1px solid #f0e2d8">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c67b5c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:2px"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
        <div style="font-size:13px;color:#8b7355;line-height:1.6">
          <span style="font-weight:700;color:#c67b5c">Smart Sync:</span> 衣长递增 S→M(+1), M→L(+1), L→XL(+2)；胸宽/肩宽/下摆 ±2cm；袖长 ±1cm
        </div>
      </div>
    </div>
  </div>

  <!-- 底部信息栏 — 用 table 布局，html2canvas 对 table 渲染最准确 -->
  <table style="width:100%;border-collapse:collapse;border-top:2px solid #2d2422">
    <tr>
      <td style="padding:20px 40px;vertical-align:top">
        <div style="font-size:24px;font-weight:900;color:#2d2422;letter-spacing:-0.01em;margin-bottom:8px">${escapeHtml(data.name)}</div>
        <table style="border-collapse:collapse"><tr>
          <td style="font-size:17px;font-weight:900;color:#2d2422;white-space:nowrap;padding-right:6px">主面料：</td>
          <td style="font-size:17px;font-weight:800;color:#6b5d4f;padding-right:28px">${escapeHtml(data.material)}</td>
          <td style="font-size:17px;font-weight:900;color:#2d2422;white-space:nowrap;padding-right:6px">辅料配件：</td>
          <td style="font-size:17px;font-weight:800;color:#8b7355;padding-left:8px">${escapeHtml(data.accessories)}</td>
        </tr></table>
      </td>
    </tr>
  </table>
</div>`
}

export default function ProductionSheetContent() {
  const router = useRouter()
  const updateCredits = useAuthStore((state) => state.updateCredits)
  const addNotification = useNotificationStore((state) => state.add)

  const [imageUrl, setImageUrl] = useState('')
  const [isExportMode, setIsExportMode] = useState(false)

  const genState = useGenerationStore((s) => s.productionSheet)
  const setGen = useGenerationStore((s) => s.setProductionSheetGen)
  const { isProcessing, showTable, error } = genState
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  // 加载历史记录
  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const [productData, setProductData] = useState<ProductData>({
    name: '等待识别...',
    material: '等待识别...',
    accessories: '等待识别...',
    date: new Date().toLocaleDateString('zh-CN'),
    specs: INITIAL_SPECS,
  })

  // 引用下载库 html2canvas
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).html2canvas) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  // 导出模式预览缩放：根据窗口宽度动态计算 zoom
  useEffect(() => {
    if (!isExportMode) return
    const updateZoom = () => {
      const wrapper = document.getElementById('preview-zoom-wrapper')
      if (!wrapper) return
      const available = window.innerWidth - 64 // 减去 padding
      const zoom = Math.min(available / 1200, 1)
      wrapper.style.zoom = String(Math.max(zoom, 0.3))
    }
    updateZoom()
    window.addEventListener('resize', updateZoom)
    return () => window.removeEventListener('resize', updateZoom)
  }, [isExportMode])

  const handleUpload = (url: string) => {
    setImageUrl(url)
    if (!url) {
      setGen({ showTable: false, error: '' })
      setProductData({
        name: '等待识别...',
        material: '等待识别...',
        accessories: '等待识别...',
        date: new Date().toLocaleDateString('zh-CN'),
        specs: INITIAL_SPECS,
      })
      return
    }
    // 上传后不自动分析，等待用户点击"开始分析"按钮
    setGen({ showTable: false, error: '' })
  }

  const handleStartAnalysis = async () => {
    if (!imageUrl || genState.isProcessing) return

    setGen({ isProcessing: true, error: '' })
    try {
      const data = await workspaceApi.analyzeProductionSheet(imageUrl)
      updateCredits(data.credits)

      const baseS = {
        length: data.length || 0,
        chest: data.chest || 0,
        shoulder: data.shoulder || 0,
        sleeve: data.sleeve || 0,
        bottom: data.bottom || 0,
      }

      setProductData({
        name: data.styleName || '欧美女装款式',
        material: data.material || '自定义面料',
        accessories: data.accessories || '常规辅料',
        date: new Date().toLocaleDateString('zh-CN'),
        specs: processGrading(baseS),
      })
      setGen({ showTable: true })

      // 保存到历史记录
      const record: HistoryRecord = {
        id: Date.now().toString(),
        imageUrl,
        productData: {
          name: data.styleName || '欧美女装款式',
          material: data.material || '自定义面料',
          accessories: data.accessories || '常规辅料',
          date: new Date().toLocaleDateString('zh-CN'),
          specs: processGrading(baseS),
        },
        createdAt: Date.now(),
      }
      const newHistory = [record, ...loadHistory()].slice(0, MAX_HISTORY)
      saveHistory(newHistory)
      setHistory(newHistory)

      // 尺寸全为 0 时提示用户手动填写
      const allZero = baseS.length === 0 && baseS.chest === 0 && baseS.shoulder === 0 && baseS.sleeve === 0 && baseS.bottom === 0
      if (allZero) {
        addNotification({ type: 'success', message: 'AI 已识别款式信息，尺寸数据请手动填写 S 码后自动推算' })
      } else {
        addNotification({ type: 'success', message: 'AI 识别完成！已生成全码规格单' })
      }
    } catch (err) {
      const msg = getErrorMessage(err, 'AI 识别失败，请尝试重新上传')
      setGen({ error: msg })
      addNotification({ type: 'error', message: msg })
      // 失败时同步积分（后端可能已退还）
      void workspaceApi.getBalance().then(updateCredits).catch(() => undefined)
    } finally {
      setGen({ isProcessing: false })
    }
  }

  const handleSSizeChange = (key: keyof Omit<SpecRow, 'size'>, value: string) => {
    const val = parseFloat(value) || 0
    const currentS = productData.specs.find(s => s.size === 'S')
    if (!currentS) return
    const updatedS = { ...currentS, [key]: val }
    const { size: _, ...baseData } = updatedS
    setProductData(prev => ({ ...prev, specs: processGrading(baseData) }))
  }

  const handleRestoreHistory = (record: HistoryRecord) => {
    setImageUrl(record.imageUrl)
    setProductData(record.productData)
    setGen({ showTable: true, error: '' })
    setShowHistory(false)
    addNotification({ type: 'success', message: '已恢复历史记录' })
  }

  const handleDeleteHistory = (id: string) => {
    const newHistory = history.filter(r => r.id !== id)
    saveHistory(newHistory)
    setHistory(newHistory)
  }

  const handleSaveToFavorite = async () => {
    if (!imageUrl) {
      addNotification({ type: 'error', message: '请先上传图片' })
      return
    }
    try {
      await workspaceApi.createFavorite({
        type: 'clothing',
        name: productData.name || '生产单款式',
        data: {
          source: 'production-sheet',
          imageUrl,
          material: productData.material,
          accessories: productData.accessories,
          specs: productData.specs,
        } as unknown as Record<string, unknown>,
        previewUrl: imageUrl,
      })
      addNotification({ type: 'success', message: '已存入素材库' })
    } catch {
      addNotification({ type: 'error', message: '存入素材库失败' })
    }
  }

  const downloadImage = () => {
    if (typeof window === 'undefined' || !(window as any).html2canvas) {
      addNotification({ type: 'error', message: '下载插件正在加载，请稍候再试' })
      return
    }

    setGen({ isProcessing: true })

    setTimeout(() => {
      // 创建离屏容器，避免滚动/缩放/定位干扰 html2canvas 渲染
      const offscreen = document.createElement('div')
      offscreen.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;'
      document.body.appendChild(offscreen)

      // 用纯内联样式构建导出内容（避免 Tailwind CSS 变量解析问题）
      offscreen.innerHTML = buildExportHtml(productData, imageUrl)

      ;(window as any).html2canvas(offscreen.firstElementChild, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        width: 1200,
        windowWidth: 1200,
        windowHeight: 900,
        scrollX: 0,
        scrollY: 0,
      }).then((canvas: HTMLCanvasElement) => {
        const link = document.createElement('a')
        link.download = `欧美女装生产单-${productData.name}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        document.body.removeChild(offscreen)
        setGen({ isProcessing: false })
      }).catch((err: Error) => {
        console.error('Canvas Error:', err)
        addNotification({ type: 'error', message: '导出失败，请重试' })
        document.body.removeChild(offscreen)
        setGen({ isProcessing: false })
      })
    }, 300)
  }

  // ─── 导出模式 ───
  if (isExportMode) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col bg-[#2d2422] overflow-hidden">
        {/* 操作栏 */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8 md:py-4 flex-shrink-0"
          style={{ background: 'var(--bg-sidebar)' }}
        >
          <button
            onClick={() => setIsExportMode(false)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-[var(--text-primary)] transition-all"
            style={{ background: 'rgba(139,115,85,0.06)', border: '1px solid var(--border-normal)' }}
          >
            <ArrowLeft size={16} /> 返回编辑
          </button>
          <button
            onClick={downloadImage}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-95"
            style={{ background: isProcessing ? '#b0a59a' : 'linear-gradient(135deg, #c67b5c, #d4a882)', boxShadow: isProcessing ? 'none' : '0 4px 16px rgba(198,123,92,0.35)' }}
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            一键下载高清图
          </button>
        </div>

        {/* 预览区：可横向滚动查看完整大图 */}
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {/* zoom 缩放容器：移动端缩小预览，桌面端原尺寸。zoom 会改变布局空间，不像 transform:scale */}
          <div id="preview-zoom-wrapper" style={{ zoom: 1 }}>
            <div
              ref={exportRef}
              className="bg-white flex flex-col"
              style={{ width: '1200px', minHeight: '780px' }}
              dangerouslySetInnerHTML={{ __html: buildExportHtml(productData, imageUrl) }}
            />
          </div>
        </div>

        {/* 移动端滚动提示 */}
        <div className="md:hidden text-center py-2 text-xs text-[var(--text-tertiary)] flex-shrink-0">
          ← 左右滑动查看完整预览 →
        </div>
      </div>
    )
  }

  // ─── 编辑模式 ───
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[var(--bg-page)] overflow-hidden">
      {/* 顶部导航 */}
      <div className="flex items-center gap-2.5 px-4 py-3"
        style={{ background: 'var(--bg-glass-strong)', backdropFilter: 'blur(20px)' }}
      >
        <button
          type="button"
          onClick={() => router.push('/tools')}
          className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: 'rgba(139,115,85,0.06)' }}
        >
          <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
        <div className="w-8 h-8 rounded-2xl hidden md:flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b7355, #c67b5c)' }}>
          <FileText className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">生产单</h1>
          <p className="hidden md:block text-xs text-[var(--text-tertiary)] truncate">上传服装图片，AI 自动识别款式信息和尺寸，生成全码规格单</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* ─── 左栏：上传 + 参数编辑 ─── */}
            <div className="lg:col-span-4 space-y-5">
              {/* 上传区 */}
              <div className="fashion-glass rounded-2xl p-4 md:p-5">
                <div className="mb-3">
                  <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#c67b5c]" /> 样照/生产单原图
                  </h3>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">上传欧美女装图片，AI 自动解析款式与 S 码尺寸</p>
                </div>
                <ImageUploadPicker
                  label="样照"
                  value={imageUrl}
                  onChange={handleUpload}
                  sourceType="clothing"
                  helperText="上传服装生产单或样照"
                />
                {imageUrl && !showTable && (
                  <button
                    type="button"
                    onClick={handleStartAnalysis}
                    disabled={isProcessing}
                    className="w-full mt-3 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: isProcessing ? '#b0a59a' : 'linear-gradient(135deg, #c67b5c, #d4a882)', boxShadow: isProcessing ? 'none' : '0 4px 16px rgba(198,123,92,0.3)' }}
                  >
                    {isProcessing ? (
                      <><Loader2 size={16} className="animate-spin" /> AI 分析中...</>
                    ) : (
                      <><Scissors size={16} /> 开始分析</>
                    )}
                  </button>
                )}
              </div>

              {/* 款式参数 */}
              <div className="fashion-glass rounded-2xl p-4 md:p-5">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border-light)]">
                  <FileText size={16} className="text-[#c67b5c]" /> 款式参数 <span className="text-xs font-normal text-[var(--text-quaternary)]">（支持手动微调）</span>
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-quaternary)] tracking-wide uppercase mb-1.5 block">款式名称</label>
                    <input
                      className="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold text-[var(--text-primary)] outline-none transition-all"
                      style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-normal)' }}
                      value={productData.name}
                      onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-quaternary)] tracking-wide uppercase mb-1.5 block">主面料材质</label>
                    <input
                      className="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold text-[var(--text-primary)] outline-none transition-all"
                      style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-normal)' }}
                      value={productData.material}
                      onChange={(e) => setProductData({ ...productData, material: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-quaternary)] tracking-wide uppercase mb-1.5 block">辅料配件描述</label>
                    <textarea
                      className="w-full px-3 py-2.5 rounded-2xl text-sm font-semibold text-[var(--text-primary)] outline-none transition-all resize-none"
                      style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-normal)' }}
                      rows={2}
                      value={productData.accessories}
                      onChange={(e) => setProductData({ ...productData, accessories: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 历史记录 */}
              <div className="fashion-glass rounded-2xl p-4 md:p-5">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between text-sm font-bold text-[var(--text-primary)]"
                >
                  <span className="flex items-center gap-2">
                    <History size={16} className="text-[#c67b5c]" /> 历史记录
                    {history.length > 0 && (
                      <span className="text-xs font-bold text-[var(--text-tertiary)] bg-[var(--bg-active)] px-1.5 py-0.5 rounded">{history.length}</span>
                    )}
                  </span>
                  <ChevronLeft size={16} className={`text-[var(--text-quaternary)] transition-transform ${showHistory ? '-rotate-90' : 'rotate-0'}`} />
                </button>

                {showHistory && (
                  <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto">
                    {history.length === 0 ? (
                      <p className="text-xs text-[var(--text-quaternary)] text-center py-6">暂无历史记录</p>
                    ) : (
                      history.map(record => (
                        <div
                          key={record.id}
                          className="group flex items-start gap-2.5 p-2.5 rounded-2xl transition-all cursor-pointer hover:bg-[var(--bg-muted)]"
                          style={{ border: '1px solid var(--border-light)' }}
                          onClick={() => handleRestoreHistory(record)}
                        >
                          <img
                            src={record.imageUrl}
                            alt={record.productData.name}
                            className="w-10 h-10 rounded-2xl object-cover flex-shrink-0"
                            style={{ border: '1px solid var(--border-normal)' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-[var(--text-primary)] truncate">{record.productData.name}</div>
                            <div className="text-xs text-[var(--text-quaternary)] flex items-center gap-1 mt-0.5">
                              <Clock size={9} /> {new Date(record.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteHistory(record.id) }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-2xl hover:bg-[rgba(196,112,112,0.08)] transition-all flex-shrink-0"
                          >
                            <Trash2 size={12} className="text-[#c47070]" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ─── 右栏：表格 + 操作 ─── */}
            <div className="lg:col-span-8">
              {isProcessing ? (
                <div className="h-full flex flex-col items-center justify-center py-20 fashion-glass rounded-2xl">
                  <div className="relative w-16 h-16 mb-5">
                    <div className="absolute inset-0 rounded-full border-4 border-[rgba(198,123,92,0.15)]" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#c67b5c] animate-spin" />
                  </div>
                  <p className="font-bold text-[var(--text-primary)] text-lg mb-1">AI 正在解析欧美女装样照...</p>
                  <p className="text-xs text-[var(--text-tertiary)]">提取表格尺寸数据并按规则进行全码数推导</p>
                </div>
              ) : showTable ? (
                <div className="space-y-5">
                  {/* 状态条 */}
                  <div className="flex justify-between items-center px-1">
                    <div>
                      <h2 className="text-lg font-bold text-[var(--text-primary)]">AI 自动生成全码规格单</h2>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Base S: 支持编辑，修改后全码联动</p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #8b7355, #c67b5c)' }}
                    >
                      <CheckCircle2 size={12} /> 数据解析完成
                    </div>
                  </div>

                  {/* 尺寸表格 */}
                  <div className="fashion-glass rounded-2xl overflow-hidden -mx-4 md:mx-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[480px] md:min-w-0 md:table-fixed">
                        <thead>
                          <tr className="bg-[#2d2422] text-white">
                            <th className="p-2 md:p-4 text-left font-bold opacity-60 uppercase text-xs tracking-widest w-[100px] md:w-[180px]">测量部位</th>
                            {productData.specs.map(s => (
                              <th key={s.size} className={`p-2 md:p-4 text-center font-bold text-sm md:text-sm ${s.size === 'S' ? 'bg-[#c67b5c]' : ''}`}>
                                {s.size}
                                {s.size === 'S' && <span className="text-xs block opacity-70 font-normal">可编辑</span>}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(139,115,85,0.06)]">
                          {([
                            { l: '衣长', e: 'Body Length', k: 'length' as const },
                            { l: '胸宽', e: '1/2 Chest', k: 'chest' as const },
                            { l: '肩宽', e: 'Shoulder Width', k: 'shoulder' as const },
                            { l: '袖长', e: 'Sleeve Length', k: 'sleeve' as const },
                            { l: '下摆', e: '1/2 Bottom', k: 'bottom' as const },
                          ]).map(row => (
                            <tr key={row.k} className="hover:bg-[var(--bg-muted)] transition-colors">
                              <td className="p-2 md:p-4 font-bold text-[var(--text-primary)] whitespace-nowrap">
                                {row.l} <span className="text-xs text-[var(--text-quaternary)] ml-1 font-normal uppercase hidden lg:inline">{row.e}</span>
                              </td>
                              {productData.specs.map(s => (
                                <td key={s.size} className={`p-1.5 md:p-2 text-center text-xs md:text-sm min-w-[56px] md:min-w-0 ${s.size === 'S' ? 'bg-[var(--bg-active)]' : 'font-bold text-[var(--text-primary)]'}`}>
                                  {s.size === 'S' ? (
                                    <input
                                      type="number"
                                      step="0.5"
                                      className="w-full px-1 py-1 text-center font-bold text-[#c67b5c] rounded outline-none transition-colors text-xs md:text-sm"
                                      style={{ background: 'white', border: '2px solid rgba(198,123,92,0.25)' }}
                                      value={s[row.k] || ''}
                                      onChange={(e) => handleSSizeChange(row.k, e.target.value)}
                                    />
                                  ) : (
                                    s[row.k]
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsExportMode(true)}
                      className="py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all active:scale-[0.98]"
                      style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)', boxShadow: '0 4px 16px rgba(198,123,92,0.3)' }}
                    >
                      <ImageIcon size={18} /> 生成并下载导出大图
                    </button>
                    <button
                      onClick={handleSaveToFavorite}
                      className="py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 text-[var(--text-secondary)] transition-all active:scale-[0.98]"
                      style={{ background: 'var(--bg-muted)', border: '2px solid rgba(139,115,85,0.12)' }}
                    >
                      <BookmarkPlus size={18} /> 存入素材库
                    </button>
                  </div>

                  {/* 联动逻辑说明 */}
                  <div className="p-4 rounded-2xl flex gap-4 shadow-sm"
                    style={{ background: 'rgba(198,123,92,0.04)', border: '1px solid rgba(198,123,92,0.12)' }}
                  >
                    <div className="p-2.5 rounded-2xl shadow-sm flex-shrink-0" style={{ background: 'var(--bg-active)' }}>
                      <Scissors size={18} className="text-[#c67b5c]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#c67b5c] mb-1 uppercase tracking-widest">欧美女装联动逻辑 (Smart Sync)</h4>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
                        修改 <span className="text-[#c67b5c] underline">S 码数值</span> 会立即重新计算：
                        衣长递增 S→M(+1), M→L(+1), L→XL(+2)。
                        其余部位胸宽、肩宽、下摆均匀按 ±2cm 档差分布，袖长 ±1cm。
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-28 fashion-glass rounded-2xl">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(139,115,85,0.06)' }}
                  >
                    <ImageIcon size={32} className="text-[var(--text-quaternary)]" />
                  </div>
                  <p className="text-[var(--text-primary)] font-bold text-center px-6">请在左侧上传欧美女装图片解析</p>
                  <p className="text-xs text-[var(--text-quaternary)] mt-2 px-10 text-center uppercase tracking-widest font-semibold">
                    Western Style Garment Recognition & Grading Engine
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 flex items-center gap-2 text-[#c47070] text-xs p-3 rounded-2xl font-medium"
                  style={{ background: 'rgba(196,112,112,0.06)', border: '1px solid rgba(196,112,112,0.15)' }}
                >
                  <AlertCircle size={14} /> {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
