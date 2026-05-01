'use client'

import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api/admin'
import { getErrorMessage } from '@/lib/utils/api'
import { formatDateTime } from '@/lib/utils/format'
import { Megaphone, Send, Loader2, Users, User, Globe } from 'lucide-react'
import type { Customer } from '@/lib/types'

export default function NotificationsContent() {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [targetMode, setTargetMode] = useState<'all' | 'selected'>('all')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    adminApi.getCustomers().then(setCustomers).catch(() => {})
    adminApi.getNotifications().then(setHistory).catch(() => {})
  }, [])

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleSend = async () => {
    if (!title.trim()) { setError('标题不能为空'); return }
    setSending(true)
    setError('')
    setSuccess('')
    try {
      const payload: { title: string; content?: string; targetUserIds?: string[] } = { title: title.trim(), content: content.trim() || undefined }
      if (targetMode === 'selected' && selectedUserIds.size > 0) {
        payload.targetUserIds = Array.from(selectedUserIds)
      }
      const result = await adminApi.sendNotification(payload)
      setSuccess(`发送成功！共 ${result.count} 条通知`)
      setTitle('')
      setContent('')
      setSelectedUserIds(new Set())
      adminApi.getNotifications().then(setHistory).catch(() => {})
    } catch (err) {
      setError(getErrorMessage(err, '发送失败'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">通知管理</h1>
        </div>
        <p className="text-gray-500 text-sm ml-[52px]">向全部或指定用户发送系统通知和公告</p>
      </div>

      {error && <div className="bg-[rgba(196,112,112,0.08)] text-red-600 px-4 py-3 rounded-2xl text-sm font-medium border border-red-100">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-2xl text-sm font-medium border border-green-100">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 发送表单 */}
        <div className="fashion-glass rounded-2xl p-6">
          <h3 className="text-[15px] font-bold text-gray-900 mb-4">发送通知</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">标题 *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：系统维护公告"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-white text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">内容</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="通知详细内容（选填）"
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-white text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
              />
            </div>

            {/* 发送对象 */}
            <div>
              <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-2">发送对象</label>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setTargetMode('all')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] font-semibold border transition-all ${
                    targetMode === 'all' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" /> 全体用户
                </button>
                <button
                  onClick={() => setTargetMode('selected')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-[12px] font-semibold border transition-all ${
                    targetMode === 'selected' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <User className="w-3.5 h-3.5" /> 指定用户
                </button>
              </div>
              {targetMode === 'selected' && (
                <div className="max-h-[200px] overflow-y-auto border border-gray-200 rounded-2xl p-2 flex flex-col gap-1">
                  {customers.filter((c) => c.role !== 'ADMIN').map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-2xl hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={selectedUserIds.has(c.id)} onChange={() => toggleUser(c.id)} className="rounded" />
                      <span className="text-[12px] text-gray-700">{c.email}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">{c.credits} 积分</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSend}
              disabled={sending || !title.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl text-white text-[14px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)', boxShadow: '0 2px 10px rgba(249,115,22,0.2)' }}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? '发送中...' : targetMode === 'selected' && selectedUserIds.size > 0 ? `发送给 ${selectedUserIds.size} 人` : '发送给全体用户'}
            </button>
          </div>
        </div>

        {/* 发送历史 */}
        <div className="fashion-glass rounded-2xl p-6">
          <h3 className="text-[15px] font-bold text-gray-900 mb-4">发送历史</h3>
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-[13px]">暂无发送记录</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto">
              {history.map((n: any) => (
                <div key={n.id} className="p-3 bg-gray-50/60 rounded-2xl border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-gray-800">{n.title}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${n.userId ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                      {n.userId ? n.targetEmail || '指定' : '全体'}
                    </span>
                  </div>
                  {n.content && <p className="text-[11px] text-gray-500 mb-1 line-clamp-2">{n.content}</p>}
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span>{formatDateTime(n.createdAt)}</span>
                    <span>{n.isRead ? '已读' : '未读'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
