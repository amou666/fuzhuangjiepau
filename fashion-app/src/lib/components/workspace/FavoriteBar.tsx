'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { workspaceApi } from '@/lib/api/workspace'
import type { Favorite, FavoriteType } from '@/lib/types'
import { Star, ChevronDown, ChevronUp, Trash2, Plus, Loader2, Check } from 'lucide-react'

interface FavoriteBarProps {
  type: FavoriteType
  currentData: Record<string, unknown>
  onLoad: (data: Record<string, unknown>) => void
  previewUrl?: string
}

export function FavoriteBar({ type, currentData, onLoad, previewUrl }: FavoriteBarProps) {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showNameInput, setShowNameInput] = useState(false)
  const [name, setName] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const saveSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (saveSuccessTimer.current) clearTimeout(saveSuccessTimer.current) }
  }, [])

  const typeLabel = type === 'model' ? '模特' : type === 'scene' ? '场景' : '完整配置'

  const fetchFavorites = useCallback(async () => {
    setLoading(true)
    try {
      const data = await workspaceApi.getFavorites(type)
      setFavorites(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [type])

  useEffect(() => {
    if (expanded && favorites.length === 0) {
      void fetchFavorites()
    }
  }, [expanded, favorites.length, fetchFavorites])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const fav = await workspaceApi.createFavorite({
        type,
        name: name.trim(),
        data: currentData,
        previewUrl,
      })
      setFavorites((prev) => [fav, ...prev])
      setName('')
      setShowNameInput(false)
      setSaveSuccess(true)
      if (saveSuccessTimer.current) clearTimeout(saveSuccessTimer.current)
      saveSuccessTimer.current = setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err) {
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await workspaceApi.deleteFavorite(id)
      setFavorites((prev) => prev.filter((f) => f.id !== id))
    } catch {
      alert('删除失败')
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-[rgba(139,115,85,0.08)] overflow-hidden">
      {/* Toggle bar */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[rgba(139,115,85,0.02)]"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-[#d4a06a]" />
          <span className="text-[12px] font-semibold text-[#8b7355]">
            {typeLabel}收藏
          </span>
          {favorites.length > 0 && (
            <span className="text-[10px] text-[#b0a59a]">({favorites.length})</span>
          )}
          {saveSuccess && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-[#7d9b76] font-medium">
              <Check className="w-3 h-3" /> 已保存
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[#b0a59a]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#b0a59a]" />}
      </button>

      {expanded && (
        <div className="border-t border-[rgba(139,115,85,0.06)] px-4 py-3">
          {/* Save current */}
          <div className="mb-3">
            {showNameInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-1.5 rounded-lg text-[12px] bg-[rgba(139,115,85,0.03)] border border-[rgba(139,115,85,0.1)] outline-none focus:border-[rgba(198,123,92,0.3)] transition-colors text-[#2d2422]"
                  placeholder={`输入${typeLabel}收藏名称...`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #c67b5c, #d4a882)' }}
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : '保存'}
                </button>
                <button
                  type="button"
                  className="px-2 py-1.5 rounded-lg text-[11px] text-[#b0a59a] hover:text-[#8b7355] transition-colors"
                  onClick={() => { setShowNameInput(false); setName(''); }}
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#c67b5c] bg-[rgba(198,123,92,0.06)] hover:bg-[rgba(198,123,92,0.1)] border border-[rgba(198,123,92,0.12)] transition-all"
                onClick={() => setShowNameInput(true)}
              >
                <Plus className="w-3 h-3" /> 保存当前{typeLabel}为收藏
              </button>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-4 text-[#b0a59a]">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-[11px] text-[#c9bfb5] text-center py-3">
              暂无收藏，保存当前配置试试
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[rgba(139,115,85,0.03)] transition-colors group"
                >
                  {fav.previewUrl && (
                    <div className="w-8 h-8 rounded-md overflow-hidden border border-[rgba(139,115,85,0.08)] flex-shrink-0">
                      <img src={fav.previewUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[#2d2422] truncate">{fav.name}</div>
                    <div className="text-[10px] text-[#c9bfb5]">
                      {new Date(fav.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded-md text-[10px] font-medium text-[#c67b5c] bg-[rgba(198,123,92,0.06)] hover:bg-[rgba(198,123,92,0.12)] transition-colors"
                    onClick={() => onLoad(fav.data as Record<string, unknown>)}
                  >
                    加载
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded text-[#c9bfb5] hover:text-[#c47070] opacity-0 group-hover:opacity-100 transition-all"
                    onClick={() => handleDelete(fav.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
