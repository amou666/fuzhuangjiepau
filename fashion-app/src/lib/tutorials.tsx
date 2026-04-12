import { Upload, Sliders, Sparkles, Eye, Image as ImageIcon, Palette, Layers, Shirt, Lightbulb, Users, GitCompareArrows, BarChart3, Star, Clock, Download } from 'lucide-react'
import type { TutorialStep } from '@/lib/components/common/TutorialModal'

export const TUTORIALS: Record<string, TutorialStep[]> = {
  workspace: [
    {
      title: '上传服装图片',
      content: '第一步：上传你的服装正面图。可选上传背面图和细节图，帮助 AI 更准确地理解服装结构和面料。\n\n支持 PNG、JPG、WEBP 格式，最大 10MB。',
      icon: <Upload className="w-5 h-5 text-white" />,
    },
    {
      title: '配置模特参数',
      content: '第二步：选择模特的性别、体型、肤色、姿势和表情。可以上传真人照片让 AI 参考，也可以全部由 AI 生成。\n\n提示：收藏常用的模特配置，下次一键加载。',
      icon: <Sliders className="w-5 h-5 text-white" />,
    },
    {
      title: '选择场景',
      content: '第三步：选择拍摄场景（城市街道、时尚展厅、自然户外等）。可以调节光线、构图、景深、比例等高级参数。\n\n也支持上传自己的场景图片。',
      icon: <ImageIcon className="w-5 h-5 text-white" />,
    },
    {
      title: '生成与查看结果',
      content: '点击「开始生成」，AI 将处理你的请求。完成后结果会自动显示。\n\n你可以在历史记录中查看所有结果，支持高清放大、下载和对比。',
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
      content: '结果图左下角有原图缩略图，点「对比」可滑块对比。\n\n满意某个方案？点「深化」让 AI 生成该方向的微调变体。点「工作台」可把改款结果发送去生成上身效果图。',
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
      content: '选择模特基础属性后点击「生成模特」。可选上传一张面部参考图让 AI 参考五官。\n\n生成的模特可以直接发送到工作台，同步参数配置。消耗 1 积分。',
      icon: <Sliders className="w-5 h-5 text-white" />,
    },
    {
      title: '图片融合',
      content: '上传 2-3 张参考照片，调节权重滑块控制每人贡献比例。\n\n三种策略：均衡融合 / 最优特征 / 主导融合。消耗 1 积分。',
      icon: <Layers className="w-5 h-5 text-white" />,
    },
    {
      title: '发送到工作台',
      content: '结果图下方点击「发送到工作台」，模特形象和参数会一并同步。\n\n到工作台后即可直接上传服装、选择场景，生成最终大片。',
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
      content: '素材库用来保存你常用的模特配置、场景配置或完整方案，方便下次一键复用。\n\n在工作台的模特和场景步骤中，上方都有「收藏」栏。',
      icon: <Star className="w-5 h-5 text-white" />,
    },
    {
      title: '收藏与加载',
      content: '在工作台配好参数后，点收藏栏的「保存」即可收藏当前配置。\n\n下次直接点击收藏项就能一键加载全部参数，节省重复操作。',
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
