import { Wand2 } from 'lucide-react'
import QuickWorkspaceContent from './QuickWorkspaceContent'

export const metadata = {
  title: '工作台 - Amou 服装工作室',
  description: '上传衣服 + 模特 + 场景图，一键合成街拍级成片',
}

export default function QuickWorkspacePage() {
  return (
    <div className="w-full min-h-full">
      <div className="max-w-[1400px] mx-auto">
        {/* Desktop header - 服务端直出 HTML */}
        <div className="hidden md:flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #c67b5c 0%, #d4a882 100%)' }}
              >
                <Wand2 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)]">工作台</h1>
            </div>
            <p className="text-[13px] text-[var(--text-tertiary)] ml-[52px] tracking-wide">上传衣服 + 模特 + 场景图，一键合成街拍级成片。</p>
          </div>
          <div className="hidden md:flex items-center gap-3 text-[11px] text-[var(--text-quaternary)] tracking-widest uppercase" />
        </div>

        {/* 交互内容 */}
        <QuickWorkspaceContent />
      </div>
    </div>
  )
}
