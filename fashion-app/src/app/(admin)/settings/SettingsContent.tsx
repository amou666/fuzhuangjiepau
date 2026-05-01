'use client'

import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api/admin'
import { getErrorMessage } from '@/lib/utils/api'
import { Droplets, Save, Loader2, Cpu, RotateCcw, Check } from 'lucide-react'

const POSITIONS = [
  { value: 'top-left', label: '左上' },
  { value: 'top-right', label: '右上' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
  { value: 'center', label: '居中' },
]

const GEN_MODEL_PRESETS = ['gpt-image-2-all', 'gpt-4o', 'gemini-2.5-flash-image']
const ANALYSIS_MODEL_PRESETS = ['nano-banana-2', 'gpt-4o-mini', 'gpt-4o', 'gemini-2.5-flash']

export default function SettingsContent() {
  // 水印
  const [watermark, setWatermark] = useState({
    enabled: false, text: '', position: 'bottom-right', opacity: 0.3, fontSize: 14,
  })
  const [wmLoading, setWmLoading] = useState(true)
  const [wmSaving, setWmSaving] = useState(false)
  const [wmSaved, setWmSaved] = useState(false)

  // AI 模型
  const [aiModel, setAiModel] = useState('')
  const [defaultAiModel, setDefaultAiModel] = useState('')
  const [analysisModel, setAnalysisModel] = useState('')
  const [defaultAnalysisModel, setDefaultAnalysisModel] = useState('')
  const [modelLoading, setModelLoading] = useState(true)
  const [modelSaving, setModelSaving] = useState(false)
  const [modelSavedAt, setModelSavedAt] = useState<number | null>(null)
  const [modelError, setModelError] = useState('')

  useEffect(() => {
    adminApi.getWatermark()
      .then(setWatermark)
      .catch(() => {})
      .finally(() => setWmLoading(false))

    adminApi.getSystemConfig()
      .then((sc) => {
        setAiModel(sc.aiModel || '')
        setDefaultAiModel(sc.defaultAiModel || '')
        setAnalysisModel(sc.analysisModel || '')
        setDefaultAnalysisModel(sc.defaultAnalysisModel || '')
      })
      .catch((err) => setModelError(getErrorMessage(err, '加载 AI 模型配置失败')))
      .finally(() => setModelLoading(false))
  }, [])

  const handleSaveWatermark = async () => {
    setWmSaving(true)
    try {
      await adminApi.updateWatermark(watermark)
      setWmSaved(true)
      setTimeout(() => setWmSaved(false), 2000)
    } catch (err) {
      alert(getErrorMessage(err, '保存失败'))
    } finally {
      setWmSaving(false)
    }
  }

  const handleSaveModels = async () => {
    setModelSaving(true)
    setModelError('')
    try {
      const sc = await adminApi.updateSystemConfig({
        aiModel: aiModel.trim(),
        analysisModel: analysisModel.trim(),
      })
      setAiModel(sc.aiModel || '')
      setDefaultAiModel(sc.defaultAiModel || '')
      setAnalysisModel(sc.analysisModel || '')
      setDefaultAnalysisModel(sc.defaultAnalysisModel || '')
      setModelSavedAt(Date.now())
      setTimeout(() => setModelSavedAt(null), 2500)
    } catch (err) {
      setModelError(getErrorMessage(err, '保存 AI 模型失败'))
    } finally {
      setModelSaving(false)
    }
  }

  const handleResetModels = async () => {
    const genDefault = defaultAiModel || 'gpt-image-2-all'
    const analyzeDefault = defaultAnalysisModel || 'nano-banana-2'
    if (!confirm(`恢复为默认模型？\n  · 生图模型：${genDefault}\n  · 分析模型：${analyzeDefault}`)) return
    setAiModel('')
    setAnalysisModel('')
    setModelSaving(true)
    setModelError('')
    try {
      const sc = await adminApi.updateSystemConfig({ aiModel: '', analysisModel: '' })
      setAiModel(sc.aiModel || '')
      setDefaultAiModel(sc.defaultAiModel || '')
      setAnalysisModel(sc.analysisModel || '')
      setDefaultAnalysisModel(sc.defaultAnalysisModel || '')
      setModelSavedAt(Date.now())
      setTimeout(() => setModelSavedAt(null), 2500)
    } catch (err) {
      setModelError(getErrorMessage(err, '恢复默认模型失败'))
    } finally {
      setModelSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1.5">系统设置</h1>
        <p className="m-0 text-gray-500 text-sm">管理 AI 模型、水印、品牌等全局配置</p>
      </div>

      {/* AI 模型设置 */}
      {modelLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载 AI 模型配置...
        </div>
      ) : (
        <div className="fashion-glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-900 m-0 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-500" />
              AI 模型设置
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveModels}
                disabled={modelSaving}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white border-none rounded-2xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(168,85,247,0.3)] hover:shadow-[0_4px_16px_rgba(168,85,247,0.4)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              >
                {modelSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : modelSavedAt ? <Check className="w-4 h-4" /> : null}
                {modelSavedAt ? '已保存' : '保存'}
              </button>
              <button
                onClick={handleResetModels}
                disabled={modelSaving}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white/70 text-gray-700 border border-black/10 rounded-2xl text-sm font-medium backdrop-blur-sm hover:bg-white/90 hover:border-purple-500/30 hover:text-purple-500 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                恢复默认
              </button>
            </div>
          </div>

          {modelError && (
            <div className="mb-4 bg-[rgba(196,112,112,0.08)] text-red-600 px-3.5 py-2 rounded-2xl text-[12px] border border-red-100">
              {modelError}
            </div>
          )}

          {/* 生图模型 */}
          <div className="border-b border-black/5 pb-5 mb-5">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h3 className="text-[13px] font-semibold text-gray-700">生图模型</h3>
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <span>默认:</span>
                <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-600">
                  {defaultAiModel || 'gpt-image-2-all'}
                </code>
                <span>·</span>
                <span>当前生效:</span>
                <code className="px-1.5 py-0.5 rounded bg-purple-50 font-mono text-purple-600">
                  {(aiModel && aiModel.trim()) || defaultAiModel || 'gpt-image-2-all'}
                </code>
              </div>
            </div>
            <p className="text-[12px] text-gray-500 mb-3 leading-relaxed">
              用于常规工作台、快速工作台、模特工厂、AI 改款等所有输出<strong>图片</strong>的调用。留空或点击「恢复默认」则回退到环境变量 <code className="font-mono">AI_MODEL</code> 或内置默认。
            </p>
            <input
              className="w-full px-3.5 py-2.5 bg-white/75 border border-black/10 rounded-[10px] text-sm text-gray-800 transition-all focus:outline-none focus:border-purple-500 focus:ring-[3px] focus:ring-purple-500/15 backdrop-blur-sm font-mono"
              type="text"
              value={aiModel}
              disabled={modelSaving}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder={defaultAiModel || 'gpt-image-2-all'}
              spellCheck={false}
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-gray-400 self-center mr-1">常用预设:</span>
              {GEN_MODEL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAiModel(preset)}
                  disabled={modelSaving}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-all disabled:opacity-50 ${
                    aiModel === preset
                      ? 'bg-purple-500 text-white border-purple-500'
                      : 'bg-white/70 text-gray-600 border-black/10 hover:border-purple-500/40 hover:text-purple-500'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* 分析模型 */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h3 className="text-[13px] font-semibold text-gray-700">分析模型</h3>
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <span>默认:</span>
                <code className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-600">
                  {defaultAnalysisModel || 'nano-banana-2'}
                </code>
                <span>·</span>
                <span>当前生效:</span>
                <code className="px-1.5 py-0.5 rounded bg-emerald-50 font-mono text-emerald-600">
                  {(analysisModel && analysisModel.trim()) || defaultAnalysisModel || 'nano-banana-2'}
                </code>
              </div>
            </div>
            <p className="text-[12px] text-gray-500 mb-3 leading-relaxed">
              用于服装识别、材质 DNA、AI 改款脑暴、模特/场景描述等输出<strong>文本</strong>的调用。留空或点击「恢复默认」则回退到环境变量 <code className="font-mono">ANALYSIS_MODEL</code> 或内置默认。
            </p>
            <input
              className="w-full px-3.5 py-2.5 bg-white/75 border border-black/10 rounded-[10px] text-sm text-gray-800 transition-all focus:outline-none focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/15 backdrop-blur-sm font-mono"
              type="text"
              value={analysisModel}
              disabled={modelSaving}
              onChange={(e) => setAnalysisModel(e.target.value)}
              placeholder={defaultAnalysisModel || 'nano-banana-2'}
              spellCheck={false}
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-gray-400 self-center mr-1">常用预设:</span>
              {ANALYSIS_MODEL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAnalysisModel(preset)}
                  disabled={modelSaving}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-all disabled:opacity-50 ${
                    analysisModel === preset
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white/70 text-gray-600 border-black/10 hover:border-emerald-500/40 hover:text-emerald-500'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 水印设置 */}
      {wmLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载水印配置...
        </div>
      ) : (
        <div className="fashion-glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-900 m-0 mb-5 flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-500" />
            图片水印
          </h2>

          <div className="flex flex-col gap-5">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-800">启用水印</div>
                <div className="text-xs text-gray-400 mt-0.5">开启后，用户下载图片时会自动添加文字水印</div>
              </div>
              <button
                type="button"
                className={`w-12 h-6 rounded-full transition-all cursor-pointer ${watermark.enabled ? 'bg-blue-500' : 'bg-gray-200'}`}
                onClick={() => setWatermark({ ...watermark, enabled: !watermark.enabled })}
              >
                <div className={`w-5 h-5 bg-[var(--bg-card)] rounded-full shadow-md transition-transform ${watermark.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {watermark.enabled && (
              <>
                {/* Text */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">水印文字</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={watermark.text}
                    onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
                    placeholder="例：FashionAI Studio"
                    maxLength={50}
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">位置</label>
                  <div className="flex gap-2 flex-wrap">
                    {POSITIONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        className={`px-3 py-1.5 rounded-2xl text-xs font-medium border transition-all cursor-pointer ${
                          watermark.position === p.value
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'
                        }`}
                        onClick={() => setWatermark({ ...watermark, position: p.value })}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    透明度：{Math.round(watermark.opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={watermark.opacity}
                    onChange={(e) => setWatermark({ ...watermark, opacity: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </div>

                {/* Font Size */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    字号：{watermark.fontSize}px
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={48}
                    step={2}
                    value={watermark.fontSize}
                    onChange={(e) => setWatermark({ ...watermark, fontSize: parseInt(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </div>

                {/* Preview */}
                <div className="relative bg-gray-800 rounded-2xl h-40 flex items-end justify-end overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">图片预览区</div>
                  {watermark.text && (
                    <div
                      className="absolute text-white font-bold"
                      style={{
                        opacity: watermark.opacity,
                        fontSize: `${watermark.fontSize}px`,
                        ...(watermark.position === 'top-left' ? { top: 12, left: 12 } : {}),
                        ...(watermark.position === 'top-right' ? { top: 12, right: 12 } : {}),
                        ...(watermark.position === 'bottom-left' ? { bottom: 12, left: 12 } : {}),
                        ...(watermark.position === 'bottom-right' ? { bottom: 12, right: 12 } : {}),
                        ...(watermark.position === 'center' ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' } : {}),
                        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                      }}
                    >
                      {watermark.text}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Save */}
            <button
              type="button"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold rounded-2xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 self-start"
              onClick={handleSaveWatermark}
              disabled={wmSaving}
            >
              {wmSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {wmSaved ? '已保存' : '保存设置'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
