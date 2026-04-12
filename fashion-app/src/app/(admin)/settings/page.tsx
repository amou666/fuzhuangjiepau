'use client'

import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api/admin'
import { getErrorMessage } from '@/lib/utils/api'
import { Settings, Droplets, Save, Loader2 } from 'lucide-react'

const POSITIONS = [
  { value: 'top-left', label: '左上' },
  { value: 'top-right', label: '右上' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
  { value: 'center', label: '居中' },
]

export default function AdminSettingsPage() {
  const [watermark, setWatermark] = useState({
    enabled: false, text: '', position: 'bottom-right', opacity: 0.3, fontSize: 16,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    adminApi.getWatermark()
      .then(setWatermark)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminApi.updateWatermark(watermark)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert(getErrorMessage(err, '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1.5">系统设置</h1>
        <p className="m-0 text-gray-500 text-sm">管理水印、品牌等全局配置</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...
        </div>
      ) : (
        <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h2 className="text-base font-semibold text-gray-900 m-0 mb-5 flex items-center gap-2">
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
                <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${watermark.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {watermark.enabled && (
              <>
                {/* Text */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">水印文字</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
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
                <div className="relative bg-gray-800 rounded-xl h-40 flex items-end justify-end overflow-hidden">
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 self-start"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? '已保存' : '保存设置'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
