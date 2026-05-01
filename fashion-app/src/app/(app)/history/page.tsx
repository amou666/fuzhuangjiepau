import { Clock } from 'lucide-react'
import HistoryContent from './HistoryContent'

export const metadata = {
  title: '历史记录 - Amou 服装工作室',
  description: '查看你的所有生图任务、状态与结果图片',
}

export default function HistoryPage() {
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* Desktop header - 服务端直出 HTML */}
      <div className="hidden md:block mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)' }}
          >
            <Clock className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#2d2422]">历史记录</h1>
        </div>
        <p className="text-[13px] text-[#9b8e82] ml-[52px] tracking-wide">查看你的所有生图任务、状态与结果图片</p>
      </div>

      {/* 交互内容 */}
      <HistoryContent />
    </div>
  )
}
