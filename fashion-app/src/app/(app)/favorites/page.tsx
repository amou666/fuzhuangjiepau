'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { workspaceApi } from '@/lib/api/workspace'
import { useDraftStore } from '@/lib/stores/draftStore'
import type { Favorite, FavoriteType, ModelConfig, SceneConfig } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/api'
import { formatDateTime } from '@/lib/utils/format'
import { Star, Trash2, Loader2, UserCircle, MapPin, Layers, ArrowRight } from 'lucide-react'
import { TutorialButton } from '@/lib/components/common/TutorialModal'
import { TUTORIALS } from '@/lib/tutorials'

const TYPE_TABS: { key: FavoriteType | 'all'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'all', label: '全部', icon: Star },
  { key: 'model', label: '模特配置', icon: UserCircle },
  { key: 'scene', label: '场景配置', icon: MapPin },
  { key: 'full', label: '完整配置', icon: Layers },
]

const TYPE_LABELS: Record<string, string> = {
  model: '模特',
  scene: '场景',
  full: '完整',
}

function getConfigSummary(fav: Favorite): string {
  const d = fav.data as Record<string, any>
  if (fav.type === 'model') {
    const parts: string[] = []
    if (d.category) parts.push(d.category)
    if (d.ethnicity) parts.push(d.ethnicity)
    if (d.age) parts.push(`${d.age}岁`)
    if (d.pose) {
      const label = d.pose.match(/（(.+?)）/)?.[1] || d.pose.split('（')[0]
      parts.push(label)
    }
    return parts.join(' · ') || '模特配置'
  }
  if (fav.type === 'scene') {
    const parts: string[] = []
    if (d.preset) {
      const label = d.preset.match(/（(.+?)）/)?.[1] || d.preset.split('（')[0]
      parts.push(label)
    }
    if (d.timeOfDay) parts.push(d.timeOfDay)
    if (d.lighting) parts.push(d.lighting)
    return parts.join(' · ') || '场景配置'
  }
  return '完整配置'
}

export default function FavoritesPage() {
  const router = useRouter()
  const setWorkspaceDraft = useDraftStore((s) => s.setWorkspaceDraft)
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<FavoriteType | 'all'>('all')
  const [applyMsg, setApplyMsg] = useState('')

  useEffect(() => {
    setLoading(true)
    workspaceApi.getFavorites()
      .then(setFavorites)
      .catch((err) => setError(getErrorMessage(err, '加载收藏失败')))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除这个收藏？')) return
    try {
      await workspaceApi.deleteFavorite(id)
      setFavorites((prev) => prev.filter((f) => f.id !== id))
    } catch {
      alert('删除失败')
    }
  }

  const handleApply = (fav: Favorite) => {
    const currentDraft = useDraftStore.getState().workspaceDraft
    const base = currentDraft ?? {
      clothingUrl: '', clothingBackUrl: '', clothingDetailUrls: [],
      clothingLength: undefined,
      modelConfig: { mode: 'generate' as const, category: '', age: '', ethnicity: '', gender: '', skinTone: '', bodyType: '', faceFeature: '', pose: '', expression: '' },
      sceneConfig: { mode: 'preset' as const, sceneSource: 'preset' as const, preset: '', prompt: '' },
      step: 0,
    }

    if (fav.type === 'model') {
      setWorkspaceDraft({ ...base, modelConfig: fav.data as ModelConfig, step: 1 })
    } else if (fav.type === 'scene') {
      setWorkspaceDraft({ ...base, sceneConfig: fav.data as SceneConfig, step: 2 })
    } else {
      const d = fav.data as Record<string, any>
      setWorkspaceDraft({
        ...base,
        ...(d.modelConfig ? { modelConfig: d.modelConfig } : {}),
        ...(d.sceneConfig ? { sceneConfig: d.sceneConfig } : {}),
        ...(d.clothingUrl ? { clothingUrl: d.clothingUrl } : {}),
        step: 0,
      })
    }

    setApplyMsg(`已应用「${fav.name}」`)
    setTimeout(() => setApplyMsg(''), 2000)
    router.push('/workspace')
  }

  const filtered = activeTab === 'all' ? favorites : favorites.filter((f) => f.type === activeTab)

  return (
    <div className="flex flex-col gap-5">
      {applyMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] bg-[#2d2422] text-white px-5 py-2.5 rounded-full text-[13px] font-medium shadow-xl animate-pulse">
          {applyMsg}
        </div>
      )}
      <div className="flex justify-end md:hidden -mb-1">
        <TutorialButton id="favorites" steps={TUTORIALS.favorites} />
      </div>
      <div className="hidden md:block mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #d4a06a 0%, #c67b5c 100%)' }}
          >
            <Star className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#2d2422]">素材库</h1>
          <div className="ml-auto"><TutorialButton id="favorites" steps={TUTORIALS.favorites} /></div>
        </div>
        <p className="text-[13px] text-[#9b8e82] ml-[52px] tracking-wide">管理你收藏的模特配置和场景配置，在工作台快速复用</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TYPE_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium transition-all border cursor-pointer"
            style={activeTab === key ? {
              background: 'linear-gradient(135deg, #c67b5c, #d4a882)',
              color: '#fff',
              borderColor: 'transparent',
              boxShadow: '0 2px 10px rgba(198,123,92,0.2)',
            } : {
              background: 'rgba(139,115,85,0.03)',
              color: '#8b7355',
              borderColor: 'rgba(139,115,85,0.08)',
            }}
            onClick={() => setActiveTab(key)}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {key !== 'all' && (
              <span className="text-[10px] opacity-70">
                ({favorites.filter((f) => f.type === key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-[#fef2f0] text-[#c47070] px-5 py-3.5 rounded-2xl text-sm font-medium border border-[#f0d5d0]">{error}</div>
      )}

      {loading ? (
        <div className="fashion-glass rounded-2xl p-12 text-center">
          <Loader2 className="w-7 h-7 text-[#c67b5c] animate-spin mx-auto mb-4" />
          <p className="text-[13px] text-[#9b8e82]">加载中...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="fashion-glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(212,160,106,0.08)' }}>
            <Star className="w-7 h-7 text-[#d4a06a]" style={{ opacity: 0.5 }} />
          </div>
          <h3 className="text-[15px] font-semibold text-[#b0a59a] mb-1">暂无收藏</h3>
          <p className="text-[13px] text-[#c9bfb5]">在工作台的模特或场景配置步骤中，展开「收藏」面板保存配置</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((fav) => (
            <div
              key={fav.id}
              className="fashion-glass rounded-2xl p-4 shadow-sm group"
            >
              <div className="flex items-start gap-3">
                {fav.previewUrl ? (
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-[rgba(139,115,85,0.08)] flex-shrink-0">
                    <img src={fav.previewUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: fav.type === 'model' ? 'rgba(198,123,92,0.06)' : 'rgba(125,155,118,0.06)' }}
                  >
                    {fav.type === 'model'
                      ? <UserCircle className="w-6 h-6 text-[#c67b5c]" />
                      : <MapPin className="w-6 h-6 text-[#7d9b76]" />
                    }
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold"
                      style={fav.type === 'model'
                        ? { background: 'rgba(198,123,92,0.08)', color: '#c67b5c' }
                        : { background: 'rgba(125,155,118,0.08)', color: '#5a7a53' }
                      }
                    >
                      {TYPE_LABELS[fav.type] || fav.type}
                    </span>
                    <span className="text-[10px] text-[#c9bfb5]">{formatDateTime(fav.createdAt)}</span>
                  </div>
                  <div className="text-[13px] font-semibold text-[#2d2422] truncate">{fav.name}</div>
                  <div className="text-[11px] text-[#b0a59a] truncate mt-0.5">{getConfigSummary(fav)}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-[#c67b5c] hover:bg-[rgba(198,123,92,0.08)] transition-all"
                    title="应用到工作台"
                    onClick={() => handleApply(fav)}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-[#c9bfb5] hover:text-[#c47070] hover:bg-[rgba(196,112,112,0.06)] transition-all"
                    onClick={() => handleDelete(fav.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold text-[#c67b5c] bg-[rgba(198,123,92,0.04)] border border-[rgba(198,123,92,0.1)] hover:bg-[rgba(198,123,92,0.08)] transition-all"
                onClick={() => handleApply(fav)}
              >
                <ArrowRight className="w-3 h-3" /> 应用到工作台
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
