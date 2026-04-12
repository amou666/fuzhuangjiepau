'use client'

import { useEffect, useState } from 'react'
import { adminApi } from '@/lib/api/admin'
import { getErrorMessage } from '@/lib/utils/api'
import { formatDateTime } from '@/lib/utils/format'
import { LayoutTemplate, Plus, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

interface Template {
  id: string; name: string; description: string; category: string; previewUrl?: string;
  clothingUrl?: string; modelConfig: Record<string, any>; sceneConfig: Record<string, any>;
  isActive: boolean; sortOrder: number; createdAt: string
}

const CATEGORIES = [
  { value: 'general', label: '通用' },
  { value: 'streetwear', label: '街拍' },
  { value: 'ecommerce', label: '电商' },
  { value: 'editorial', label: '杂志' },
  { value: 'lookbook', label: 'Lookbook' },
]

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', category: 'general', previewUrl: '' })

  useEffect(() => {
    setLoading(true)
    adminApi.getTemplates()
      .then(setTemplates)
      .catch((err) => setError(getErrorMessage(err, '加载模板失败')))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setCreating(true)
    try {
      const t = await adminApi.createTemplate({
        name: form.name.trim(),
        description: form.description,
        category: form.category,
        previewUrl: form.previewUrl || undefined,
        modelConfig: {},
        sceneConfig: {},
      })
      setTemplates((prev) => [t, ...prev])
      setForm({ name: '', description: '', category: 'general', previewUrl: '' })
      setShowForm(false)
    } catch (err) {
      alert(getErrorMessage(err, '创建失败'))
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const updated = await adminApi.updateTemplate(id, { isActive: !isActive })
      setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)))
    } catch (err) {
      alert(getErrorMessage(err, '更新失败'))
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除该模板？')) return
    try {
      await adminApi.deleteTemplate(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      alert(getErrorMessage(err, '删除失败'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 m-0 mb-1.5">模板管理</h1>
          <p className="m-0 text-gray-500 text-sm">创建官方预设方案，用户可在工作台一键加载</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-4 h-4" /> 新建模板
        </button>
      </div>

      {error && <div className="text-red-500 text-sm font-medium">{error}</div>}

      {showForm && (
        <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h3 className="text-[15px] font-semibold text-gray-900 mb-4">创建新模板</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">名称 *</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例：都市街拍高级感"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">分类</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">描述</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="简要描述模板效果和适用场景"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">预览图 URL（可选）</label>
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={form.previewUrl}
                onChange={(e) => setForm({ ...form, previewUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mb-4">创建后可编辑模特/场景配置的完整 JSON，或通过 API 更新。</p>
          <div className="flex gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold rounded-xl shadow-md disabled:opacity-50"
              onClick={handleCreate}
              disabled={creating || !form.name.trim()}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              创建
            </button>
            <button
              type="button"
              className="px-5 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
              onClick={() => setShowForm(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 bg-white/40 rounded-2xl border border-dashed border-black/[0.08]">
          <LayoutTemplate className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">暂无模板，点击上方按钮创建</p>
        </div>
      ) : (
        <div className="bg-white/65 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">名称</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">分类</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">描述</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">状态</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">创建时间</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50/50">操作</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-blue-500/[0.03] transition-colors">
                    <td className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        {t.previewUrl && (
                          <img src={t.previewUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-100" />
                        )}
                        <span className="font-semibold text-gray-800">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b border-gray-100">
                      <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[11px] font-medium">
                        {CATEGORIES.find((c) => c.value === t.category)?.label || t.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-gray-100 text-gray-500 max-w-[200px] truncate">{t.description || '-'}</td>
                    <td className="px-4 py-3 border-b border-gray-100">
                      <button type="button" onClick={() => handleToggle(t.id, t.isActive)} className="cursor-pointer">
                        {t.isActive
                          ? <ToggleRight className="w-6 h-6 text-green-500" />
                          : <ToggleLeft className="w-6 h-6 text-gray-300" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3 border-b border-gray-100 text-gray-400">{formatDateTime(t.createdAt)}</td>
                    <td className="px-4 py-3 border-b border-gray-100">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-2 py-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs transition-all"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="w-3 h-3" /> 删除
                      </button>
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
