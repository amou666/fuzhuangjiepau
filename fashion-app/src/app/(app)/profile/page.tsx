import { UserCircle } from 'lucide-react'
import ProfileContent from './ProfileContent'

export const metadata = {
  title: '个人中心 - Amou 服装工作室',
  description: '查看账号信息、数据统计与积分变动记录',
}

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* Desktop header - 服务端直出 HTML */}
      <div className="hidden md:block mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #8b7355 0%, #b0a59a 100%)' }}
          >
            <UserCircle className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">个人中心</h1>
        </div>
        <p className="text-sm text-[var(--text-tertiary)] ml-[52px] tracking-wide">查看账号信息、数据统计与积分变动记录</p>
      </div>

      {/* 交互内容 */}
      <ProfileContent />
    </div>
  )
}
