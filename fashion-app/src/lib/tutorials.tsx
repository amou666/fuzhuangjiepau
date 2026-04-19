import { Upload, Sliders, Sparkles, Eye, Image as ImageIcon, Palette, Layers, Shirt, Lightbulb, Users, GitCompareArrows, BarChart3, Star, Clock, Download } from 'lucide-react'
import type { TutorialStep } from '@/lib/components/common/TutorialModal'

export const TUTORIALS: Record<string, TutorialStep[]> = {
  'quick-workspace': [
    {
      title: '上传衣服',
      content: '上传服装正面（必选）和反面（可选）。清晰无遮挡的正面图效果最好。\n\n支持 PNG / JPG / WEBP / GIF，点击衣服右上角「收藏」可把这件衣服存进素材库。',
      icon: <Upload className="w-5 h-5 text-white" />,
    },
    {
      title: '选择模特',
      content: '上传一张清晰的半身/全身模特照片，作为面部与身材锚点。\n\n也可以在「模特工厂」先生成全新模特，再用「发送到快速工作台」同步过来；或从素材库直接「应用」已收藏的模特。',
      icon: <Sliders className="w-5 h-5 text-white" />,
    },
    {
      title: '选择模式 + 上传场景图',
      content: '「背景图模式」：上传纯背景图，AI 自动决定模特最佳站位与姿势。\n「融合模式」：上传带人物的图片，AI 读取原人物姿势后换成你的模特和新衣服。\n\n可配合「图片比例」「构图」微调输出。',
      icon: <ImageIcon className="w-5 h-5 text-white" />,
    },
    {
      title: '一键生成',
      content: '点击「一键生成」，右侧面板会实时显示生成进度，完成后可下载或在「历史记录」中回看。\n\n每次生图消耗 1 积分，失败会自动退回。',
      icon: <Sparkles className="w-5 h-5 text-white" />,
    },
  ],

  redesign: [
    {
      title: '上传服装原图',
      content: '上传你想改款的服装照片。AI 会自动识别材质、款式和结构信息。\n\n照片越清晰，改款效果越准确。',
      icon: <Upload className="w-5 h-5 text-white" />,
    },
    {
      title: '选择改款模式',
      content: '四种模式各有侧重：\n• 色系变色 — 只改颜色，保留所有细节\n• 加元素 — 添加工艺细节，轮廓不变\n• 改款式 — 同材质不同版型设计\n• 商业脑暴 — 完全释放 AI 创造力',
      icon: <Palette className="w-5 h-5 text-white" />,
    },
    {
      title: '设计约束与数量',
      content: '在「设计约束」框中告诉 AI 你的要求：要保留什么、不要什么、方向偏好。\n\n选择生成数量（1/3/6 张），每张消耗 1 积分。初期可以先出 1 张看方向，再追加。',
      icon: <Sliders className="w-5 h-5 text-white" />,
    },
    {
      title: '对比与深化',
      content: '结果图左下角有原图缩略图，点「对比」可滑块对比。\n\n满意某个方案？点「深化」让 AI 生成该方向的微调变体。点「快速工作台」可把改款结果发送去生成上身效果图。',
      icon: <Eye className="w-5 h-5 text-white" />,
    },
  ],

  'model-fusion': [
    {
      title: '两种模式',
      content: '「参数生成」— 按类别、年龄、人种、肤色、体型等参数从零生成全新模特\n「图片融合」— 上传多张真人照片，AI 融合面部特征\n\n顶部 Tab 切换即可。',
      icon: <Users className="w-5 h-5 text-white" />,
    },
    {
      title: '参数生成',
      content: '选择模特基础属性后点击「生成模特」。可选上传一张面部参考图让 AI 参考五官。\n\n生成的模特可以直接发送到快速工作台，一键合成服装上身效果。消耗 1 积分。',
      icon: <Sliders className="w-5 h-5 text-white" />,
    },
    {
      title: '图片融合',
      content: '上传 2-3 张参考照片，调节权重滑块控制每人贡献比例。\n\n三种策略：均衡融合 / 最优特征 / 主导融合。消耗 1 积分。',
      icon: <Layers className="w-5 h-5 text-white" />,
    },
    {
      title: '发送到快速工作台',
      content: '结果图下方点击「发送到快速工作台」，模特图会自动注入到快速工作台的模特位置。\n\n到快速工作台后上传服装和场景图，即可一键合成最终大片。',
      icon: <Sparkles className="w-5 h-5 text-white" />,
    },
  ],

  history: [
    {
      title: '查看历史记录',
      content: '所有生图任务都会显示在这里，包括工作台、改款和模特合成的结果。\n\n每条记录显示类型标签、状态、参考图和生成结果。',
      icon: <Clock className="w-5 h-5 text-white" />,
    },
    {
      title: '对比与批量下载',
      content: '勾选 2 张以上已完成的任务，可以：\n• 点「对比」进入全屏对比模式（支持滑块对比）\n• 点「打包下载」一键下载 ZIP 压缩包',
      icon: <GitCompareArrows className="w-5 h-5 text-white" />,
    },
    {
      title: '高清放大',
      content: '每张结果图都可以点击「变高清」按钮进行 2x 超分辨率放大。\n\n放大后的图片会显示绿色边框标识。',
      icon: <Sparkles className="w-5 h-5 text-white" />,
    },
  ],

  favorites: [
    {
      title: '什么是素材库',
      content: '素材库用来保存你常用的服装、模特、场景图片，方便下次在「快速工作台」一键复用。\n\n在「快速工作台」每个上传区块的标题右侧都有「收藏」按钮。',
      icon: <Star className="w-5 h-5 text-white" />,
    },
    {
      title: '收藏与加载',
      content: '在快速工作台上传图片后，点击每块右上的「收藏」即可命名保存到素材库。\n\n素材库里点击收藏卡片的「应用到快速工作台」，会把对应图片自动填回到快速工作台。',
      icon: <Download className="w-5 h-5 text-white" />,
    },
  ],

  profile: [
    {
      title: '账号信息',
      content: '查看你的邮箱、角色和当前积分余额。API Key 可以点击旁边的图标复制。',
      icon: <Users className="w-5 h-5 text-white" />,
    },
    {
      title: '积分记录',
      content: '下方表格显示所有积分变动明细：充值、消耗和退款。\n\n绿色表示积分增加，红色表示消耗。如需充值请联系管理员。',
      icon: <Lightbulb className="w-5 h-5 text-white" />,
    },
  ],

  stats: [
    {
      title: '数据一览',
      content: '顶部四张卡片显示核心指标：总生图数、成功数、积分消耗和当前余额。',
      icon: <BarChart3 className="w-5 h-5 text-white" />,
    },
    {
      title: '趋势与偏好',
      content: '下方图表展示：\n• 近 14 天的每日生图量和积分消耗趋势\n• 任务成功/失败分布\n• 你最常用的模特性别、体型、姿势和场景偏好排行',
      icon: <Eye className="w-5 h-5 text-white" />,
    },
  ],
}
