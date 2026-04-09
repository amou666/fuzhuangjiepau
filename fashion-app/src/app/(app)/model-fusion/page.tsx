'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageUploader } from '@/lib/components/common/ImageUploader'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import { useNotificationStore } from '@/lib/stores/notificationStore'
import { getErrorMessage } from '@/lib/utils/api'

const DRAFT_KEY = 'fashion-ai-workspace-draft'

export default function ModelFusionPage() {
  const router = useRouter()
  const [model1, setModel1] = useState('')
  const [model2, setModel2] = useState('')
  const [model3, setModel3] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const updateCredits = useAuthStore((state) => state.updateCredits)
  const addNotification = useNotificationStore((state) => state.add)

  const canFuse = model1 || model2 || model3
  const modelCount = [model1, model2, model3].filter(Boolean).length

  const handleFuse = async () => {
    if (!canFuse) return
    setSubmitting(true)
    setError('')
    setResultUrl('')

    try {
      const urls = [model1, model2, model3].filter(Boolean)
      const data = await workspaceApi.fuseModels(urls)
      setResultUrl(data.resultUrl)
      updateCredits(await workspaceApi.getBalance())
      addNotification({ type: 'success', message: '模特合成完成！' })
    } catch (err) {
      setError(getErrorMessage(err, '模特合成失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownload = () => {
    if (!resultUrl) return
    const link = document.createElement('a')
    link.href = resultUrl
    link.download = `model-fusion-${Date.now()}.png`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSendToWorkspace = () => {
    if (!resultUrl) return
    try {
      const existing = localStorage.getItem(DRAFT_KEY)
      const draft = existing ? JSON.parse(existing) : {}
      draft.modelConfig = {
        ...(draft.modelConfig || {}),
        mode: 'upload',
        imageUrl: resultUrl,
      }
      // 确保必要字段存在
      if (!draft.clothingUrl) draft.clothingUrl = ''
      if (!draft.sceneConfig) {
        draft.sceneConfig = {
          mode: 'preset',
          sceneSource: 'preset',
          preset: 'city street（城市街道）',
          timeOfDay: '',
          lighting: '',
          composition: '',
          prompt: '',
        }
      }
      if (draft.step === undefined) draft.step = 1
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      addNotification({ type: 'success', message: '已发送到工作台模特参考图，正在跳转...' })
      router.push('/workspace')
    } catch {
      addNotification({ type: 'error', message: '发送到工作台失败' })
    }
  }

  const openPreview = (src: string) => {
    setPreviewSrc(src)
  }

  const closePreview = () => {
    setPreviewSrc(null)
  }

  return (
    <div className="workspace-container">
      <div className="workspace-header">
        <h1>模特合成</h1>
        <p>上传 1-3 张模特参考图，AI 将融合面部特征生成全新的模特半身像。</p>
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: '16px' }}>{error}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
        <div className="workspace-panel" style={{ margin: 0 }}>
          <div className="workspace-panel-header">
            <h3 className="workspace-panel-title">模特 A</h3>
            <p className="workspace-panel-subtitle">上传第一张模特参考图</p>
          </div>
          <ImageUploader label="模特A" value={model1} onChange={setModel1} />
        </div>

        <div className="workspace-panel" style={{ margin: 0 }}>
          <div className="workspace-panel-header">
            <h3 className="workspace-panel-title">模特 B</h3>
            <p className="workspace-panel-subtitle">上传第二张模特参考图</p>
          </div>
          <ImageUploader label="模特B" value={model2} onChange={setModel2} />
        </div>

        <div className="workspace-panel" style={{ margin: 0 }}>
          <div className="workspace-panel-header">
            <h3 className="workspace-panel-title">模特 C</h3>
            <p className="workspace-panel-subtitle">上传第三张模特参考图</p>
          </div>
          <ImageUploader label="模特C" value={model3} onChange={setModel3} />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <button
          className="generate-btn"
          type="button"
          onClick={() => { void handleFuse() }}
          disabled={!canFuse || submitting}
          style={{ maxWidth: '320px', width: '100%' }}
        >
          <div>{submitting ? '合成中...' : '合成模特'}</div>
          <div className="generate-btn-cost">消耗 1 积分 · 融合 {modelCount} 位模特</div>
        </button>
      </div>

      {resultUrl && (
        <div className="workspace-panel" style={{ margin: 0 }}>
          <div className="workspace-panel-header">
            <h3 className="workspace-panel-title">合成结果</h3>
            <p className="workspace-panel-subtitle">融合后的新模特半身像</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <img
              src={resultUrl}
              alt="合成结果"
              onClick={() => openPreview(resultUrl)}
              style={{
                maxWidth: '512px',
                width: '100%',
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                cursor: 'pointer',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '20px' }}>
            <button
              className="btn"
              type="button"
              onClick={handleDownload}
              style={{ minWidth: '140px' }}
            >
              下载图片
            </button>
            <button
              className="btn"
              type="button"
              onClick={handleSendToWorkspace}
              style={{ minWidth: '200px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              发送到工作台
            </button>
          </div>
        </div>
      )}

      {/* 图片放大预览弹窗 */}
      {previewSrc && (
        <div
          onClick={closePreview}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            cursor: 'pointer',
          }}
        >
          <img
            src={previewSrc}
            alt="放大预览"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              borderRadius: '8px',
              boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '28px',
              color: '#fff',
              fontSize: '32px',
              cursor: 'pointer',
              opacity: 0.8,
            }}
            onClick={closePreview}
          >
            ✕
          </div>
        </div>
      )}
    </div>
  )
}
