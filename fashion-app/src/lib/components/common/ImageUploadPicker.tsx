'use client'

import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, X, Plus, Star, Loader2, Upload } from 'lucide-react'
import { workspaceApi } from '@/lib/api/workspace'
import { getImageUploadError } from '@/lib/utils/validation'
import type { Favorite, FavoriteType } from '@/lib/types'

const ACCEPT_STRING = 'image/png,image/jpeg,image/webp,image/gif'

type UploadSourceType = 'model' | 'clothing' | 'clothingBack' | 'scene'

const SOURCE_TO_FAV_TYPE: Record<UploadSourceType, FavoriteType> = {
  model: 'model',
  clothing: 'clothing',
  clothingBack: 'clothing',
  scene: 'scene',
}

const SOURCE_LABELS: Record<UploadSourceType, string> = {
  model: '模特',
  clothing: '服装正面',
  clothingBack: '服装反面',
  scene: '场景',
}

interface ImageUploadPickerProps {
  label: string
  value?: string
  onChange: (url: string) => void
  helperText?: string
  sourceType: UploadSourceType
  compact?: boolean
  fill?: boolean
}

export function ImageUploadPicker({ label, value, onChange, helperText, sourceType, compact, fill }: ImageUploadPickerProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showPicker, setShowPicker] = useState(false)
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [favLoading, setFavLoading] = useState(false)

  const processFile = async (file: File) => {
    const validationError = getImageUploadError(file)
    if (validationError) { setError(validationError); return }
    setUploading(true)
    setError('')
    try {
      const url = await workspaceApi.uploadImage(file)
      onChange(url)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    await processFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) await processFile(file)
  }

  const handleRemove = () => { onChange(''); setError('') }
  const handleClick = () => { setShowPicker(true) }

  const handleOpenFavorites = useCallback(async () => {
    setShowFavorites(true)
    setFavLoading(true)
    try {
      const list = await workspaceApi.getFavorites(SOURCE_TO_FAV_TYPE[sourceType])
      setFavorites(list)
    } catch { setFavorites([]) }
    finally { setFavLoading(false) }
  }, [sourceType])

  const handleSelectFavorite = (fav: Favorite) => {
    const data = fav.data as Record<string, unknown>
    let imageUrl = ''
    if (typeof data.imageUrl === 'string') imageUrl = data.imageUrl
    else if (typeof data.clothingUrl === 'string') imageUrl = data.clothingUrl
    else if (typeof fav.previewUrl === 'string') imageUrl = fav.previewUrl
    if (imageUrl) onChange(imageUrl)
    setShowFavorites(false)
    setShowPicker(false)
  }

  const handleLocalUpload = () => {
    setShowPicker(false)
    setTimeout(() => { fileInputRef.current?.click() }, 100)
  }

  const closePicker = () => { setShowPicker(false); setShowFavorites(false) }
  const closeFavorites = () => { setShowFavorites(false) }

  // 弹窗通过 portal 渲染到 body
  const portalModals = (
    <>
      {showPicker && !showFavorites && (
        <UploadPickerModal
          sourceLabel={SOURCE_LABELS[sourceType]}
          onLocalUpload={handleLocalUpload}
          onQuickSelect={handleOpenFavorites}
          onClose={closePicker}
        />
      )}
      {showFavorites && (
        <FavoritePickerModal
          sourceType={sourceType}
          favorites={favorites}
          loading={favLoading}
          onSelect={handleSelectFavorite}
          onClose={() => { closeFavorites(); setShowPicker(false) }}
          onBack={closeFavorites}
        />
      )}
    </>
  )

  /* ====== Has Image ====== */
  if (value) {
    return (
      <div className="flex flex-col gap-1">
        <div className="relative rounded-2xl overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-muted)] p-2">
          <img
            src={value} alt={label}
            className={compact ? 'w-full h-full object-contain block' : 'max-w-full max-h-[280px] object-contain block mx-auto'}
            style={{ transition: 'transform 0.4s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          />
          <button
            className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center border-none cursor-pointer transition-all duration-200"
            style={{ background: 'rgba(196,112,112,0.9)', color: '#fff' }}
            onClick={handleRemove} type="button"
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {helperText && <span className="text-[11px] text-[var(--text-extreme)] leading-relaxed">{helperText}</span>}
      </div>
    )
  }

  /* ====== Compact Empty ====== */
  if (compact) {
    return (
      <>
        <div
          className="w-full h-full flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all duration-200"
          style={{
            background: isDragging ? 'rgba(198,123,92,0.06)' : 'rgba(139,115,85,0.02)',
            border: isDragging ? '1.5px dashed rgba(198,123,92,0.5)' : '1.5px dashed rgba(139,115,85,0.25)',
          }}
          onClick={handleClick}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleClick()}
          onMouseEnter={(e) => { if (!isDragging) { e.currentTarget.style.borderColor = 'rgba(198,123,92,0.4)'; e.currentTarget.style.background = 'rgba(198,123,92,0.04)' } }}
          onMouseLeave={(e) => { if (!isDragging) { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.25)'; e.currentTarget.style.background = 'rgba(139,115,85,0.02)' } }}
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(198,123,92,0.2)', borderTopColor: '#c67b5c' }} />
          ) : (
            <Plus className="w-5 h-5 text-[var(--text-extreme)]" />
          )}
        </div>
        <input ref={fileInputRef} type="file" accept={ACCEPT_STRING} onChange={handleFileChange} className="hidden" />
        {error && <div className="text-[#c47070] text-[11px] font-medium mt-0.5">{error}</div>}
        {createPortal(portalModals, document.body)}
      </>
    )
  }

  /* ====== Full Empty ====== */
  return (
    <div className={`flex flex-col gap-1${fill ? ' h-full' : ''}`}>
      <div
        className={`flex flex-col items-center justify-center py-5 md:py-8 px-4 md:px-5 rounded-2xl cursor-pointer transition-all duration-200 text-center${fill ? ' flex-1' : ' min-h-[150px] md:min-h-[220px]'}`}
        style={{
          background: isDragging ? 'rgba(198,123,92,0.06)' : 'rgba(139,115,85,0.02)',
          border: isDragging ? '1.5px dashed rgba(198,123,92,0.5)' : '1.5px dashed rgba(139,115,85,0.25)',
        }}
        onClick={handleClick}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        onMouseEnter={(e) => { if (!isDragging) { e.currentTarget.style.borderColor = 'rgba(198,123,92,0.4)'; e.currentTarget.style.background = 'rgba(198,123,92,0.04)' } }}
        onMouseLeave={(e) => { if (!isDragging) { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.25)'; e.currentTarget.style.background = 'rgba(139,115,85,0.02)' } }}
      >
        <div className="mb-4">
          {uploading ? (
            <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto" style={{ borderColor: 'rgba(198,123,92,0.2)', borderTopColor: '#c67b5c' }} />
          ) : (
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--bg-active)' }}>
              <Camera className="w-5 h-5 text-[#c67b5c]" />
            </div>
          )}
        </div>
        <div className="text-[13px] font-semibold text-[var(--text-secondary)] mb-1">
          {uploading ? '上传中...' : isDragging ? '松开即可上传' : '点击选择图片'}
        </div>
        <div className="text-[11px] text-[var(--text-extreme)]">
          {helperText || '从素材库快速选择 或 本地上传'}
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept={ACCEPT_STRING} onChange={handleFileChange} className="hidden" />
      {error && <div className="text-[#c47070] text-[12px] font-medium">{error}</div>}
      {createPortal(portalModals, document.body)}
    </div>
  )
}

/* ═══════════════════════════════════════════
   选择弹窗：快速选择 / 本地上传
   ═══════════════════════════════════════════ */
function UploadPickerModal({
  sourceLabel,
  onLocalUpload,
  onQuickSelect,
  onClose,
}: {
  sourceLabel: string
  onLocalUpload: () => void
  onQuickSelect: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-[360px] bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border-light)] p-5 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">选择{sourceLabel}图片</h3>
          <button type="button" onClick={onClose} className="text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onQuickSelect}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left hover:shadow-md"
            style={{ borderColor: 'rgba(198,123,92,0.25)', background: 'rgba(198,123,92,0.04)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(198,123,92,0.45)'; e.currentTarget.style.background = 'rgba(198,123,92,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(198,123,92,0.25)'; e.currentTarget.style.background = 'rgba(198,123,92,0.04)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}>
              <Star className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">快速选择</div>
              <div className="text-[11px] text-[var(--text-secondary)]">从素材库中已收藏的{sourceLabel}选取</div>
            </div>
          </button>

          <button
            type="button"
            onClick={onLocalUpload}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left hover:shadow-md"
            style={{ borderColor: 'rgba(139,115,85,0.15)', background: 'rgba(139,115,85,0.02)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.3)'; e.currentTarget.style.background = 'rgba(139,115,85,0.05)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.15)'; e.currentTarget.style.background = 'rgba(139,115,85,0.02)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-active)' }}>
              <Upload className="w-5 h-5 text-[#c67b5c]" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">本地上传</div>
              <div className="text-[11px] text-[var(--text-secondary)]">从设备中选择图片上传</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   收藏夹快速选择弹窗
   ═══════════════════════════════════════════ */
function FavoritePickerModal({
  sourceType,
  favorites,
  loading,
  onSelect,
  onClose,
  onBack,
}: {
  sourceType: UploadSourceType
  favorites: Favorite[]
  loading: boolean
  onSelect: (fav: Favorite) => void
  onClose: () => void
  onBack: () => void
}) {
  const label = SOURCE_LABELS[sourceType]

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-[520px] max-h-[80vh] bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border-light)] flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-light)]">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-[#c67b5c]" />
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">从素材库选择{label}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-quaternary)] hover:text-[var(--text-secondary)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-[#c67b5c] mr-2" />
              <span className="text-[12px] text-[var(--text-secondary)]">加载中...</span>
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-16">
              <Star className="w-8 h-8 mx-auto mb-2 text-[var(--text-extreme)] opacity-50" />
              <div className="text-[13px] text-[var(--text-secondary)] mb-1">暂无收藏的{label}</div>
              <div className="text-[11px] text-[var(--text-quaternary)]">先上传图片并收藏后，可在此快速选择</div>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {favorites.map((fav) => (
                <button key={fav.id} type="button" onClick={() => onSelect(fav)} className="text-left group">
                  <div className="aspect-square rounded-xl overflow-hidden border border-[var(--border-normal)] bg-[var(--bg-muted)] mb-1.5 transition-all group-hover:border-[rgba(198,123,92,0.4)] group-hover:shadow-md">
                    {fav.previewUrl ? (
                      <img src={fav.previewUrl} alt={fav.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Camera className="w-5 h-5 text-[var(--text-extreme)]" />
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-primary)] font-medium truncate">{fav.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-light)]">
          <button type="button" onClick={onBack} className="w-full h-10 rounded-2xl border border-[rgba(139,115,85,0.2)] text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors">
            返回上一步
          </button>
        </div>
      </div>
    </div>
  )
}
