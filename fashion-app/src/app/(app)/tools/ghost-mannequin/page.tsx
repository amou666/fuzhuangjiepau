'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import { getErrorMessage } from '@/lib/utils/api'
import {
  Upload, Sparkles, Download, Layers, CheckCircle2, AlertCircle,
  Trash2, RefreshCw, Box, ImageIcon, Sun, ShieldCheck, Zap,
  Move, ArrowLeft, EyeOff, GitCompareArrows,
} from 'lucide-react'
import { apiClient } from '@/lib/api/client'

// ─── 风格配置 ───
const BG_MODES = [
  {
    id: 'studio-white',
    name: '纯净白底',
    desc: '最标准的批发/电商图',
    hex: '#FFFFFF',
  },
  {
    id: 'studio-grey',
    name: '经典冷灰',
    desc: '更有质感的档口风格',
    hex: '#F0F0F0',
  },
  {
    id: 'studio-sand',
    name: '高级杏色',
    desc: '温柔韩系/法式质感',
    hex: '#F5F2ED',
  },
]

// ─── 对比滑块组件 ───
function ImageCompareSlider({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [sliderPos, setSliderPos] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
      setSliderPos((x / rect.width) * 100)
    },
    []
  )

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => handleMove(e.clientX)
    const onUp = () => setIsDragging(false)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX)
    }
    const onTouchEnd = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [isDragging, handleMove])

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-2xl select-none cursor-ew-resize"
      onMouseDown={(e) => { setIsDragging(true); handleMove(e.clientX) }}
      onTouchStart={(e) => { setIsDragging(true); if (e.touches[0]) handleMove(e.touches[0].clientX) }}
    >
      {/* 右侧：生成图（底层） */}
      <img src={afterUrl} alt="生成图" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
      {/* 左侧：原图（裁剪层） */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        <img
          src={beforeUrl}
          alt="原图"
          className="absolute top-0 left-0 h-full object-contain"
          style={{ width: `${100 / (sliderPos / 100 || 1)}%`, maxWidth: 'none' }}
          draggable={false}
        />
      </div>
      {/* 分割线 */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.3)] z-10"
        style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
          <GitCompareArrows className="w-4 h-4 text-[#2d2422]" />
        </div>
      </div>
      {/* 标签 */}
      <div className="absolute top-3 left-3 bg-black/50 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
        原图
      </div>
      <div className="absolute top-3 right-3 bg-[#c67b5c]/80 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
        生成图
      </div>
    </div>
  )
}

export default function GhostMannequinPage() {
  const router = useRouter()
  const updateCredits = useAuthStore((state) => state.updateCredits)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedBg, setSelectedBg] = useState('studio-white')
  const [isDragging, setIsDragging] = useState(false)

  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [genStatus, setGenStatus] = useState('就绪')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const [brightness, setBrightness] = useState(100)
  const [showCompare, setShowCompare] = useState(false)

  const [optimizePage, setOptimizePage] = useState(true)
  const [removeWatermark, setRemoveWatermark] = useState(true)
  const [enhanceDetails, setEnhanceDetails] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }

  const processFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) {
      setErrorMessage('请上传有效的图片文件')
      return
    }
    setErrorMessage('')
    const url = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewUrl(url)
    setResultUrl(null)
    setShowCompare(false)
    setBrightness(100)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    processFile(file)
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    processFile(file)
  }

  const triggerFileInput = () => fileInputRef.current?.click()

  const handleGenerate = async () => {
    if (!previewUrl || !selectedFile) return
    if (isGenerating) return

    setErrorMessage('')
    setIsGenerating(true)
    setProgress(5)
    setGenStatus('正在上传图片...')

    const statusSequence = [
      { p: 20, s: '正在提取服装主体...' },
      { p: 40, s: '正在重塑 3D 廓形...' },
      { p: 60, s: '正在强制重置数字化背景...' },
      { p: 80, s: '正在增强面料细节...' },
      { p: 90, s: '正在进行最后渲染...' },
    ]
    let seqIdx = 0
    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (seqIdx < statusSequence.length && prev >= statusSequence[seqIdx].p) {
          setGenStatus(statusSequence[seqIdx].s)
          seqIdx++
        }
        return prev < 95 ? prev + 1 : prev
      })
    }, 180)

    try {
      // 1. 上传图片
      const uploadedUrl = await workspaceApi.uploadImage(selectedFile)

      // 2. 调用后端 API
      const response = await apiClient.post<{ resultUrl: string; taskId: string; credits: number }>('/ghost-mannequin', {
        imageUrl: uploadedUrl,
        styleId: selectedBg,
        optimizePage,
        removeWatermark,
        enhanceDetails,
      })

      const { resultUrl: genUrl, credits } = response.data
      setResultUrl(genUrl)
      setProgress(100)
      setGenStatus('完成')
      updateCredits(credits)
    } catch (err) {
      setErrorMessage(getErrorMessage(err, '生成失败，请检查图片质量或重试'))
      setGenStatus('失败')
    } finally {
      clearProgressTimer()
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    const imageUrl = resultUrl || previewUrl
    if (!imageUrl) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')!
      ctx.filter = `brightness(${brightness}%)`
      ctx.drawImage(img, 0, 0)
      const link = document.createElement('a')
      link.download = `隐形模特-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setResultUrl(null)
    setShowCompare(false)
    setBrightness(100)
    setErrorMessage('')
    setGenStatus('就绪')
    setProgress(0)
  }

  useEffect(() => {
    return () => clearProgressTimer()
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#faf7f4] overflow-hidden">
      {/* 顶部导航 */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[rgba(139,115,85,0.08)]"
        style={{ background: 'rgba(255,253,250,0.95)', backdropFilter: 'blur(20px)' }}
      >
        <button
          type="button"
          onClick={() => router.push('/tools')}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: 'rgba(139,115,85,0.06)' }}
        >
          <ArrowLeft className="w-4 h-4 text-[#8b7355]" />
        </button>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8b7355, #c67b5c)' }}>
          <Box className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-[16px] font-bold tracking-tight text-[#2d2422]">一键3D图</h1>
          <p className="text-[11px] text-[#9b8e82] truncate">随手挂拍或人台图，增强细节，自动布局，生成3D隐形模特图</p>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-5 overflow-hidden p-4 md:p-5">
        {/* 左侧预览区 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full h-full rounded-2xl border-2 relative overflow-hidden flex items-center justify-center transition-all duration-300 ${
              isDragging
                ? 'border-[#c67b5c] border-dashed bg-[rgba(198,123,92,0.04)]'
                : 'border-[rgba(139,115,85,0.08)] bg-white'
            }`}
            style={{ boxShadow: 'inset 0 0 40px rgba(139,115,85,0.03)' }}
          >
            {!previewUrl ? (
              <div className="flex flex-col items-center cursor-pointer group" onClick={triggerFileInput}>
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center mb-5 group-hover:scale-105 transition-all"
                  style={{ background: 'rgba(139,115,85,0.06)', border: '1px solid rgba(139,115,85,0.08)' }}
                >
                  <Upload className="text-[#c9bfb5] group-hover:text-[#8b7355] transition-colors" size={36} />
                </div>
                <p className="text-base font-bold text-[#2d2422]">上传样衣拍摄图</p>
                <p className="text-[13px] text-[#9b8e82] mt-2 flex items-center">
                  <Move size={14} className="mr-1.5" /> 支持拖拽图片上传
                </p>
                <p className="text-[11px] text-[#c9bfb5] mt-1">支持 PNG / JPG / WEBP</p>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center p-4">
                {showCompare && resultUrl ? (
                  <ImageCompareSlider beforeUrl={previewUrl} afterUrl={resultUrl} />
                ) : (
                  <img
                    src={resultUrl || previewUrl}
                    alt="Preview"
                    style={{ filter: `brightness(${brightness}%)`, maxHeight: '100%', maxWidth: '100%' }}
                    className={`object-contain rounded-xl transition-all duration-700 ${isGenerating ? 'blur-md grayscale scale-95 opacity-60' : 'scale-100'}`}
                  />
                )}

                {/* 生成中遮罩 */}
                {isGenerating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm">
                    <div className="w-64 h-1.5 bg-[rgba(139,115,85,0.1)] rounded-full overflow-hidden mb-5">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #c67b5c, #d4a882)' }}
                      />
                    </div>
                    <RefreshCw className="w-5 h-5 text-[#c67b5c] animate-spin mb-3" />
                    <p className="text-[13px] font-semibold text-[#2d2422] tracking-wide">{genStatus}</p>
                    <p className="text-[11px] text-[#9b8e82] mt-1">{progress}%</p>
                  </div>
                )}

                {/* 悬浮工具栏 */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                  {resultUrl && !isGenerating && (
                    <>
                      <button
                        onClick={handleDownload}
                        className="w-10 h-10 bg-[#2d2422] text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-all"
                        title="下载成品"
                      >
                        <Download size={18} />
                      </button>
                      <button
                        onClick={() => setShowCompare((v) => !v)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-all ${
                          showCompare ? 'bg-[#c67b5c] text-white' : 'bg-white text-[#2d2422]'
                        }`}
                        style={{ border: '1px solid rgba(139,115,85,0.1)' }}
                        title={showCompare ? '退出对比' : '对比原图/生成图'}
                      >
                        {showCompare ? <EyeOff size={18} /> : <GitCompareArrows size={18} />}
                      </button>
                    </>
                  )}
                  <button
                    onClick={triggerFileInput}
                    className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg text-[#8b7355] hover:text-[#2d2422] transition-all hover:scale-110"
                    style={{ border: '1px solid rgba(139,115,85,0.1)' }}
                    title="更换图片"
                  >
                    <ImageIcon size={18} />
                  </button>
                  <button
                    onClick={handleReset}
                    className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg text-[#c9bfb5] hover:text-red-500 transition-all hover:scale-110"
                    style={{ border: '1px solid rgba(139,115,85,0.1)' }}
                    title="清空"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧控制面板 */}
        <div className="w-full lg:w-[340px] flex flex-col gap-4 overflow-y-auto">
          {/* 风格选择 */}
          <div className="fashion-glass rounded-2xl p-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#b0a59a] mb-4 flex items-center">
              <Layers size={14} className="mr-2" /> 风格选择
            </h3>
            <div className="space-y-2.5">
              {BG_MODES.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => setSelectedBg(bg.id)}
                  className={`w-full flex items-center p-3 rounded-xl border-2 transition-all ${
                    selectedBg === bg.id
                      ? 'border-[#c67b5c] bg-[rgba(198,123,92,0.04)]'
                      : 'border-transparent hover:bg-[rgba(139,115,85,0.03)]'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg shadow-inner mr-3 shrink-0"
                    style={{ backgroundColor: bg.hex, border: '1px solid rgba(0,0,0,0.06)' }}
                  />
                  <div className="text-left">
                    <p className="text-[13px] font-bold text-[#2d2422]">{bg.name}</p>
                    <p className="text-[11px] text-[#9b8e82]">{bg.desc}</p>
                  </div>
                  {selectedBg === bg.id && <CheckCircle2 className="ml-auto text-[#c67b5c]" size={16} />}
                </button>
              ))}
            </div>
          </div>

          {/* 图像调节 */}
          {resultUrl && (
            <div className="fashion-glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#b0a59a] flex items-center">
                  <Sun size={14} className="mr-2" /> 亮度调节
                </h3>
                <span className="text-[11px] font-mono font-bold bg-[rgba(139,115,85,0.06)] px-2 py-0.5 rounded text-[#8b7355]">
                  {brightness}%
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full h-1.5 bg-[rgba(139,115,85,0.1)] rounded-lg appearance-none cursor-pointer accent-[#c67b5c]"
              />
              <div className="flex justify-between text-[10px] text-[#c9bfb5] font-bold uppercase mt-2">
                <span>暗调</span>
                <span>标准</span>
                <span>高亮</span>
              </div>
            </div>
          )}

          {/* 智能引擎 */}
          <div
            className="rounded-2xl p-5 relative overflow-hidden flex-1 flex flex-col"
            style={{
              background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)',
              boxShadow: '0 8px 32px rgba(198,123,92,0.2)',
            }}
          >
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70 mb-4 flex items-center">
              <Zap size={14} className="mr-2" /> 智能引擎
            </h3>

            <div className="space-y-4 flex-1">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-bold text-white">3D 廓形重塑</span>
                <div className="w-9 h-4 rounded-full flex items-center px-1" style={{ background: 'rgba(255,255,255,0.3)' }}>
                  <div className="w-2.5 h-2.5 bg-white rounded-full ml-auto" />
                </div>
              </div>

              <ToggleRow label="页面布局优化" checked={optimizePage} onChange={setOptimizePage} />
              <ToggleRow
                label="去除图片水印"
                checked={removeWatermark}
                onChange={setRemoveWatermark}
                icon={<ShieldCheck size={12} className="ml-1.5 text-blue-400" />}
              />
              <ToggleRow label="增强面料细节" checked={enhanceDetails} onChange={setEnhanceDetails} />
            </div>

            <div className="pt-4 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <button
                onClick={handleGenerate}
                disabled={!previewUrl || isGenerating}
                className={`w-full py-3.5 rounded-xl font-bold text-[13px] uppercase tracking-wider transition-all relative ${
                  !previewUrl || isGenerating
                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                    : 'bg-white text-[#2d2422] hover:bg-[#f5f0ec] shadow-xl active:scale-[0.98]'
                }`}
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin" /> 正在重构...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles size={16} /> 开始重构隐形模特
                  </span>
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-2.5 text-red-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="text-[12px] font-semibold leading-relaxed">{errorMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* 底部状态 */}
      <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-[#c9bfb5] font-medium border-t border-[rgba(139,115,85,0.06)]">
        <span className={`w-1.5 h-1.5 rounded-full ${isGenerating ? 'bg-amber-400 animate-pulse' : 'bg-green-500'}`} />
        <span>引擎状态: {genStatus}</span>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
    </div>
  )
}

// ─── 开关行组件 ───
function ToggleRow({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  icon?: React.ReactNode
}) {
  return (
    <div className="flex justify-between items-center cursor-pointer" onClick={() => onChange(!checked)}>
      <div className="flex items-center">
        <span className="text-[12px] font-bold text-white">{label}</span>
        {icon}
      </div>
      <div
        className={`w-9 h-4 rounded-full flex items-center px-0.5 transition-colors ${
          checked ? 'bg-white/40' : 'bg-white/15'
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full transition-all ${checked ? 'bg-white ml-auto' : 'bg-white/40'}`}
        />
      </div>
    </div>
  )
}
