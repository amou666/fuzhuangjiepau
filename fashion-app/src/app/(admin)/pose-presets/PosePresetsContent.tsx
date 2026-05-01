'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { adminApi } from '@/lib/api/admin'
import { workspaceApi } from '@/lib/api/workspace'
import { getErrorMessage } from '@/lib/utils/api'
import { formatDateTime } from '@/lib/utils/format'
import { PersonStanding, Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Upload, Image as ImageIcon, Pencil, X, Check, Sparkles } from 'lucide-react'

interface PosePresetItem {
  id: string
  category: string
  label: string
  prompt: string
  thumbnailUrl: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const CATEGORIES = [
  { value: 'daily', label: '日常' },
  { value: 'beach', label: '海边' },
  { value: 'street', label: '街拍' },
  { value: 'studio', label: '棚拍' },
]

const emptyForm = { category: 'daily', label: '', prompt: '', thumbnailUrl: '', sortOrder: 0 }

export default function PosePresetsContent() {
  const [presets, setPresets] = useState<PosePresetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [uploading, setUploading] = useState(false)

  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<PosePresetItem>>({})
  const [editUploading, setEditUploading] = useState(false)

  // AI 自动生成 Prompt 状态
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [editGeneratingPrompt, setEditGeneratingPrompt] = useState(false)
  // 记录用户是否手动修改过 prompt，手动修改后不再自动覆盖
  const promptManuallyEditedRef = useRef(false)
  const editPromptManuallyEditedRef = useRef(false)

  // ─── 自动生成 Prompt（创建表单） ───
  const autoGeneratePrompt = useCallback(async (label: string, category: string) => {
    if (!label.trim()) return
    if (promptManuallyEditedRef.current) return
    setGeneratingPrompt(true)
    try {
      const prompt = await adminApi.generatePosePrompt(label, category)
      if (!promptManuallyEditedRef.current) {
        setForm((prev) => ({ ...prev, prompt }))
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'AI 生成 Prompt 失败'
      console.error('[Auto Generate Prompt]', msg)
    } finally {
      setGeneratingPrompt(false)
    }
  }, [])

  // ─── 自动生成 Prompt（编辑表单） ───
  const autoGenerateEditPrompt = useCallback(async (label: string, category: string) => {
    if (!label.trim()) return
    if (editPromptManuallyEditedRef.current) return
    setEditGeneratingPrompt(true)
    try {
      const prompt = await adminApi.generatePosePrompt(label, category)
      if (!editPromptManuallyEditedRef.current) {
        setEditForm((prev) => ({ ...prev, prompt }))
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'AI 生成 Prompt 失败'
      console.error('[Auto Generate Edit Prompt]', msg)
    } finally {
      setEditGeneratingPrompt(false)
    }
  }, [])

  // 筛选
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    adminApi.getPosePresets()
      .then((data) => setPresets(data as PosePresetItem[]))
      .catch((err) => setError(getErrorMessage(err, '加载姿势预设失败')))
      .finally(() => setLoading(false))
  }, [])

  const filteredPresets = filterCategory === 'all'
    ? presets
    : presets.filter((p) => p.category === filterCategory)

  // ─── 上传图片 ───
  const handleUpload = async (file: File, target: 'create' | 'edit') => {
    if (target === 'create') setUploading(true)
    else setEditUploading(true)
    try {
      const url = await workspaceApi.uploadImage(file)
      if (target === 'create') {
        setForm((prev) => ({ ...prev, thumbnailUrl: url }))
      } else {
        setEditForm((prev) => ({ ...prev, thumbnailUrl: url }))
      }
    } catch (err) {
      alert(getErrorMessage(err, '上传失败'))
    } finally {
      if (target === 'create') setUploading(false)
      else setEditUploading(false)
    }
  }

  // ─── 创建 ───
  const handleCreate = async () => {
    if (!form.label.trim()) return
    setCreating(true)
    try {
      const t = await adminApi.createPosePreset({
        category: form.category,
        label: form.label.trim(),
        prompt: form.prompt,
        thumbnailUrl: form.thumbnailUrl || undefined,
        sortOrder: form.sortOrder,
      })
      setPresets((prev) => [t as PosePresetItem, ...prev])
      setForm(emptyForm)
      setShowForm(false)
    } catch (err) {
      alert(getErrorMessage(err, '创建失败'))
    } finally {
      setCreating(false)
    }
  }

  // ─── 切换启用/禁用 ───
  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const updated = await adminApi.updatePosePreset(id, { isActive: !isActive })
      setPresets((prev) => prev.map((p) => (p.id === id ? (updated as PosePresetItem) : p)))
    } catch (err) {
      alert(getErrorMessage(err, '更新失败'))
    }
  }

  // ─── 删除 ───
  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除该姿势预设？')) return
    try {
      await adminApi.deletePosePreset(id)
      setPresets((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      alert(getErrorMessage(err, '删除失败'))
    }
  }

  // ─── 保存编辑 ───
  const handleSaveEdit = async (id: string) => {
    try {
      const updated = await adminApi.updatePosePreset(id, editForm)
      setPresets((prev) => prev.map((p) => (p.id === id ? (updated as PosePresetItem) : p)))
      setEditingId(null)
      setEditForm({})
    } catch (err) {
      alert(getErrorMessage(err, '更新失败'))
    }
  }

  // ─── 开始编辑 ───
  const startEdit = (p: PosePresetItem) => {
    setEditingId(p.id)
    setEditForm({
      category: p.category,
      label: p.label,
      prompt: p.prompt,
      thumbnailUrl: p.thumbnailUrl,
      sortOrder: p.sortOrder,
    })
    editPromptManuallyEditedRef.current = false
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1.5">姿势管理</h1>
          <p className="m-0 text-gray-500 text-sm">管理套图模式的姿势预设，可上传参考图</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-4 h-4" /> 新建姿势
        </button>
      </div>

      {error && <div className="text-red-500 text-sm font-medium">{error}</div>}

      {/* ─── 创建表单 ─── */}
      {showForm && (
        <div className="fashion-glass rounded-2xl p-6">
          <h3 className="text-[15px] font-semibold text-gray-900 mb-4">创建新姿势</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">姿势名称 *</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.label}
                onChange={(e) => {
                  setForm({ ...form, label: e.target.value })
                  promptManuallyEditedRef.current = false
                }}
                onBlur={() => {
                  if (form.label.trim()) autoGeneratePrompt(form.label, form.category)
                }}
                placeholder="例：叉腰自信"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">分类</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.category}
                onChange={(e) => {
                  const val = e.target.value
                  setForm({ ...form, category: val })
                  promptManuallyEditedRef.current = false
                }}
                onBlur={() => {
                  if (form.label.trim()) autoGeneratePrompt(form.label, form.category)
                }}
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                英文 Prompt（注入 AI 提示词）
                {generatingPrompt && (
                  <span className="ml-2 text-blue-500 inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3 animate-pulse" /> AI 生成中...
                  </span>
                )}
              </label>
              <textarea
                className={`w-full px-3 py-2 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none ${generatingPrompt ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'}`}
                rows={2}
                value={form.prompt}
                onChange={(e) => {
                  setForm({ ...form, prompt: e.target.value })
                  promptManuallyEditedRef.current = true
                }}
                placeholder={generatingPrompt ? 'AI 正在自动生成...' : 'standing with hands on hips, confident powerful pose...'}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">排序权重</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">参考图</label>
              <div className="flex items-center gap-3">
                {form.thumbnailUrl ? (
                  <div className="relative">
                    <img src={form.thumbnailUrl} alt="" className="w-12 h-16 rounded-2xl object-cover border border-gray-200" />
                    <button
                      type="button"
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[rgba(196,112,112,0.08)]0 text-white rounded-full flex items-center justify-center"
                      onClick={() => setForm({ ...form, thumbnailUrl: '' })}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-2xl text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? '上传中...' : '上传图片'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(f, 'create')
                    e.target.value = ''
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold rounded-2xl shadow-md disabled:opacity-50"
              onClick={handleCreate}
              disabled={creating || !form.label.trim()}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              创建
            </button>
            <button
              type="button"
              className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-2xl transition-all"
              onClick={() => { setShowForm(false); setForm(emptyForm); promptManuallyEditedRef.current = false }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* ─── 分类筛选 ─── */}
      <div className="flex gap-2">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-2xl text-xs font-medium border transition-all ${filterCategory === 'all' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-[var(--bg-card)] border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          onClick={() => setFilterCategory('all')}
        >
          全部 ({presets.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = presets.filter((p) => p.category === cat.value).length
          return (
            <button
              key={cat.value}
              type="button"
              className={`px-3 py-1.5 rounded-2xl text-xs font-medium border transition-all ${filterCategory === cat.value ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-[var(--bg-card)] border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              onClick={() => setFilterCategory(cat.value)}
            >
              {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {/* ─── 列表 ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...
        </div>
      ) : filteredPresets.length === 0 ? (
        <div className="text-center py-16 bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
          <PersonStanding className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">暂无姿势预设，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="fashion-glass rounded-2xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">参考图</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">名称</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">分类</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">Prompt</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">排序</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">状态</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredPresets.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-500/[0.03] transition-colors">
                    {/* 缩略图 */}
                    <td className="px-4 py-3 border-b border-gray-100">
                      {editingId === p.id ? (
                        <div className="flex items-center gap-2">
                          {editForm.thumbnailUrl ? (
                            <img src={editForm.thumbnailUrl} alt="" className="w-9 h-12 rounded-2xl object-cover border border-gray-200" />
                          ) : (
                            <div className="w-9 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                              <ImageIcon className="w-3 h-3 text-gray-300" />
                            </div>
                          )}
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-2xl text-[10px] text-gray-400 hover:bg-gray-50"
                            onClick={() => editFileInputRef.current?.click()}
                            disabled={editUploading}
                          >
                            {editUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          </button>
                          <input
                            ref={editFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) handleUpload(f, 'edit')
                              e.target.value = ''
                            }}
                          />
                        </div>
                      ) : p.thumbnailUrl ? (
                        <img src={p.thumbnailUrl} alt="" className="w-9 h-12 rounded-2xl object-cover border border-gray-200" />
                      ) : (
                        <div className="w-9 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                          <ImageIcon className="w-3 h-3 text-gray-300" />
                        </div>
                      )}
                    </td>
                    {/* 名称 */}
                    <td className="px-4 py-3 border-b border-gray-100">
                      {editingId === p.id ? (
                        <input
                          className="px-2 py-1 border border-gray-200 rounded-2xl text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          value={editForm.label || ''}
                          onChange={(e) => {
                            setEditForm({ ...editForm, label: e.target.value })
                            editPromptManuallyEditedRef.current = false
                          }}
                          onBlur={() => {
                            if (editForm.label?.trim()) autoGenerateEditPrompt(editForm.label, editForm.category || 'daily')
                          }}
                        />
                      ) : (
                        <span className="font-semibold text-gray-800">{p.label}</span>
                      )}
                    </td>
                    {/* 分类 */}
                    <td className="px-4 py-3 border-b border-gray-100">
                      {editingId === p.id ? (
                        <select
                          className="px-2 py-1 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                          value={editForm.category || 'daily'}
                          onChange={(e) => {
                            setEditForm({ ...editForm, category: e.target.value })
                            editPromptManuallyEditedRef.current = false
                          }}
                          onBlur={() => {
                            if (editForm.label?.trim()) autoGenerateEditPrompt(editForm.label, editForm.category || 'daily')
                          }}
                        >
                          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[11px] font-medium">
                          {CATEGORIES.find((c) => c.value === p.category)?.label || p.category}
                        </span>
                      )}
                    </td>
                    {/* Prompt */}
                    <td className="px-4 py-3 border-b border-gray-100 max-w-[260px]">
                      {editingId === p.id ? (
                        <div className="relative">
                          {editGeneratingPrompt && (
                            <span className="text-[10px] text-blue-500 flex items-center gap-0.5 mb-0.5">
                              <Sparkles className="w-2.5 h-2.5 animate-pulse" /> AI 生成中...
                            </span>
                          )}
                          <textarea
                            className={`w-full px-2 py-1 border rounded-2xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-200 ${editGeneratingPrompt ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'}`}
                            rows={2}
                            value={editForm.prompt || ''}
                            onChange={(e) => {
                              setEditForm({ ...editForm, prompt: e.target.value })
                              editPromptManuallyEditedRef.current = true
                            }}
                            placeholder={editGeneratingPrompt ? 'AI 正在自动生成...' : 'Prompt...'}
                          />
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs line-clamp-2">{p.prompt || '-'}</span>
                      )}
                    </td>
                    {/* 排序 */}
                    <td className="px-4 py-3 border-b border-gray-100 text-gray-400 text-xs">
                      {editingId === p.id ? (
                        <input
                          type="number"
                          className="w-16 px-2 py-1 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                          value={editForm.sortOrder ?? 0}
                          onChange={(e) => setEditForm({ ...editForm, sortOrder: Number(e.target.value) })}
                        />
                      ) : (
                        p.sortOrder
                      )}
                    </td>
                    {/* 状态 */}
                    <td className="px-4 py-3 border-b border-gray-100">
                      <button type="button" onClick={() => handleToggle(p.id, p.isActive)} className="cursor-pointer">
                        {p.isActive
                          ? <ToggleRight className="w-6 h-6 text-green-500" />
                          : <ToggleLeft className="w-6 h-6 text-gray-300" />
                        }
                      </button>
                    </td>
                    {/* 操作 */}
                    <td className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-1">
                        {editingId === p.id ? (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2 py-1 text-green-600 hover:bg-green-50 rounded-2xl text-xs transition-all"
                              onClick={() => handleSaveEdit(p.id)}
                            >
                              <Check className="w-3 h-3" /> 保存
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2 py-1 text-gray-400 hover:bg-gray-50 rounded-2xl text-xs transition-all"
                              onClick={() => { setEditingId(null); setEditForm({}); editPromptManuallyEditedRef.current = false }}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2 py-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl text-xs transition-all"
                              onClick={() => startEdit(p)}
                            >
                              <Pencil className="w-3 h-3" /> 编辑
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 px-2 py-1 text-red-400 hover:text-red-600 hover:bg-[rgba(196,112,112,0.08)] rounded-2xl text-xs transition-all"
                              onClick={() => handleDelete(p.id)}
                            >
                              <Trash2 className="w-3 h-3" /> 删除
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
