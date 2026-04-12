'use client'

import { useEffect, useState } from 'react'
import { authApi } from '@/lib/api/auth'
import { workspaceApi } from '@/lib/api/workspace'
import { useAuthStore } from '@/lib/stores/authStore'
import type { CreditLog } from '@/lib/types'
import { getErrorMessage } from '@/lib/utils/api'
import { formatDateTime } from '@/lib/utils/format'
import { Mail, Shield, Key, Coins, Lightbulb, ArrowUp, ArrowDown, UserCircle, Copy, Check } from 'lucide-react'
import { TutorialButton } from '@/lib/components/common/TutorialModal'
import { TUTORIALS } from '@/lib/tutorials'

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const updateCredits = useAuthStore((state) => state.updateCredits)
  const [logs, setLogs] = useState<CreditLog[]>([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void Promise.all([authApi.getMe(), workspaceApi.getBalance(), workspaceApi.getCreditHistory()])
      .then(([me, balance, history]) => {
        setUser(me)
        updateCredits(balance)
        setLogs(history.logs)
      })
      .catch((loadError) => setError(getErrorMessage(loadError, '加载个人中心失败')))
  }, [setUser, updateCredits])

  const handleCopyApiKey = () => {
    if (!user?.apiKey) return
    navigator.clipboard.writeText(user.apiKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const infoItems = [
    { label: '邮箱', value: user?.email, icon: Mail, color: '#c67b5c' },
    { label: '角色', value: user?.role === 'ADMIN' ? '管理员' : '客户', icon: Shield, color: '#8b7355' },
    { label: '积分余额', value: String(user?.credits ?? 0), icon: Coins, color: '#d4a06a' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end md:hidden -mb-1">
        <TutorialButton id="profile" steps={TUTORIALS.profile} />
      </div>
      <div className="hidden md:block mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #8b7355 0%, #b0a59a 100%)' }}
          >
            <UserCircle className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#2d2422]">个人中心</h1>
          <div className="ml-auto"><TutorialButton id="profile" steps={TUTORIALS.profile} /></div>
        </div>
        <p className="text-[13px] text-[#9b8e82] ml-[52px] tracking-wide">查看账号信息、ApiKey 与积分变动记录</p>
      </div>

      {error && (
        <div className="bg-[#fef2f0] text-[#c47070] px-5 py-3.5 rounded-2xl text-sm font-medium border border-[#f0d5d0]">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Account Info */}
        <div className="fashion-glass rounded-2xl p-6">
          <h2 className="text-[15px] font-semibold text-[#2d2422] mb-4">账号信息</h2>
          <div className="flex flex-col gap-3.5">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${item.color}12` }}
                >
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider">{item.label}</div>
                  <div className="text-[14px] font-medium text-[#2d2422]">{item.value}</div>
                </div>
              </div>
            ))}

            {/* ApiKey */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(125,155,118,0.1)' }}
              >
                <Key className="w-4 h-4 text-[#7d9b76]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider">API KEY</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-[12px] text-[#8b7355] bg-[rgba(139,115,85,0.04)] px-2 py-0.5 rounded-md font-mono truncate">
                    {user?.apiKey ?? '-'}
                  </code>
                  {user?.apiKey && (
                    <button
                      type="button"
                      className="p-1 rounded-md text-[#b0a59a] hover:text-[#c67b5c] hover:bg-[rgba(198,123,92,0.06)] transition-all flex-shrink-0"
                      onClick={handleCopyApiKey}
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#7d9b76]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="fashion-glass rounded-2xl p-6">
          <h2 className="text-[15px] font-semibold text-[#2d2422] mb-4 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#d4a06a]" />
            使用提示
          </h2>
          <div className="flex flex-col gap-3">
            <div className="px-4 py-3 bg-[rgba(212,160,106,0.06)] border border-[rgba(212,160,106,0.12)] rounded-xl text-[13px] text-[#8b7355] leading-relaxed">
              生图功能使用你专属的 AI API Key，请联系管理员获取或配置。
            </div>
            <div className="px-4 py-3 bg-[rgba(125,155,118,0.06)] border border-[rgba(125,155,118,0.12)] rounded-xl text-[13px] text-[#5a7a53] leading-relaxed">
              若积分不足，请联系管理员在后台「积分管理」中为你充值。
            </div>
            <div className="px-4 py-3 bg-[rgba(198,123,92,0.06)] border border-[rgba(198,123,92,0.12)] rounded-xl text-[13px] text-[#b0654a] leading-relaxed">
              在工作台、模特工厂、AI 改款中生成的图片都会消耗积分，可在下方查看流水。
            </div>
          </div>
        </div>
      </div>

      {/* Credit History */}
      <div className="fashion-glass rounded-2xl p-6">
        <h2 className="text-[15px] font-semibold text-[#2d2422] mb-4 flex items-center gap-2">
          <Coins className="w-4 h-4 text-[#d4a06a]" />
          积分记录
        </h2>
        {logs.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[#c9bfb5]">暂无积分变动记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider border-b border-[rgba(139,115,85,0.08)] bg-[rgba(139,115,85,0.02)]">变动</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider border-b border-[rgba(139,115,85,0.08)] bg-[rgba(139,115,85,0.02)]">余额</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider border-b border-[rgba(139,115,85,0.08)] bg-[rgba(139,115,85,0.02)]">原因</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#b0a59a] uppercase tracking-wider border-b border-[rgba(139,115,85,0.08)] bg-[rgba(139,115,85,0.02)]">时间</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[rgba(139,115,85,0.02)] transition-colors">
                    <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)]">
                      <span className={`inline-flex items-center gap-1 font-semibold ${log.delta > 0 ? 'text-[#7d9b76]' : 'text-[#c47070]'}`}>
                        {log.delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {log.delta > 0 ? `+${log.delta}` : log.delta}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)] text-[#2d2422] font-medium">{log.balanceAfter}</td>
                    <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)] text-[#8b7355]">{log.reason}</td>
                    <td className="px-4 py-3 border-b border-[rgba(139,115,85,0.04)] text-[#b0a59a]">{formatDateTime(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
