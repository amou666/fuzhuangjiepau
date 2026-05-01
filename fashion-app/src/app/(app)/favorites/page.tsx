import { Star } from 'lucide-react'
import FavoritesContent from './FavoritesContent'

export const metadata = {
  title: '收藏夹 - Amou 服装工作室',
  description: '管理你收藏的服装、模特、场景等素材，在快速工作台一键复用',
}

export default function FavoritesPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Desktop header - 服务端直出 HTML */}
      <div className="hidden md:block mb-1">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #d4a06a 0%, #c67b5c 100%)' }}
          >
            <Star className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#2d2422]">收藏夹</h1>
          <div className="ml-auto flex items-center gap-2">
            {/* 上传按钮由客户端组件 FavoritesContent 管理 */}
          </div>
        </div>
        <p className="text-[13px] text-[#9b8e82] ml-[52px] tracking-wide">管理你收藏的服装、模特、场景等素材，在快速工作台一键复用</p>
      </div>

      {/* 交互内容 */}
      <FavoritesContent />
    </div>
  )
}
