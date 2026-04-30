import { Upload, Sliders, Sparkles, Eye, Image as ImageIcon, Palette, Layers, Shirt, Users, GitCompareArrows, BarChart3, Star, Clock, Download, Wand2, Box, FileText, Droplets, GripVertical, Send, Coins } from 'lucide-react'
import type { TutorialStep } from '@/lib/components/common/TutorialModal'

export interface TutorialModule {
  key: string
  title: string
  description: string
  icon: React.ReactNode
  color: string
  steps: TutorialStep[]
}

export const TUTORIALS: Record<string, TutorialStep[]> = {
  'quick-workspace': [
    {
      title: '选择生成模式',
      content: '工作台提供两种模式：\n\n• 背景图模式 — 上传干净的背景图，AI 自动决定模特的最佳站位与姿势\n• 融合模式 — 上传含原人物的场景图，AI 将原人物的姿势与位置提取后，替换成你的模特和新衣服\n\n根据你的需求选择合适的模式。',
      icon: <ImageIcon className="w-5 h-5 text-white" />,
    },
    {
      title: '上传模特照片',
      content: '上传一张清晰的半身或全身模特照片作为面部与身材锚点。\n\n你可以从「模特工厂」生成全新模特后「发送到快速工作台」，或从「素材库」直接「应用」已收藏的模特图片。',
      icon: <Users className="w-5 h-5 text-white" />,
    },
    {
      title: '上传衣服（正面必选 + 反面可选）',
      content: '上传服装的正面照片（必选），清晰无遮挡效果最好。也可额外上传反面照片作为参考。\n\n点击每个上传区块右上角的「收藏」按钮，可以把当前图片保存到素材库，方便以后复用。',
      icon: <Shirt className="w-5 h-5 text-white" />,
    },
    {
      title: '上传场景背景图',
      content: '根据你选择的模式，上传对应的场景图：\n\n• 背景图模式 → 上传纯背景图\n• 融合模式 → 上传含原人物的场景图（AI 会读取原人物的位置与姿势）\n\n你也可以从素材库中「应用」已收藏的场景图。',
      icon: <ImageIcon className="w-5 h-5 text-white" />,
    },
    {
      title: '调整输出设置',
      content: '微调以下参数来获得理想效果：\n\n• 图片比例：3:4 / 1:1 / 4:3 / 16:9 / 9:16\n• 构图：自动 / 半身 / 全身\n• 拍摄设备：可选择单反（50mm/85mm/135mm）或手机拍摄风格，不同模式对应不同的焦距、景深和光线氛围\n• 附加提示（可选）：输入额外描述，如特定姿势、色调偏好等',
      icon: <Sliders className="w-5 h-5 text-white" />,
    },
    {
      title: '一键生成与收藏',
      content: '完成所有配置后，点击「一键生成」按钮。右侧面板会实时显示生成进度。\n\n每张图片消耗 1 积分，失败会自动退回积分。\n\n你还可以：\n• 点击「收藏完整配置」将当前全部设置打包保存到素材库\n• 在素材库中一键复用完整配置',
      icon: <Sparkles className="w-5 h-5 text-white" />,
    },
  ],

  redesign: [
    {
      title: '上传服装原图',
      content: '上传你想改款的服装照片。照片越清晰，改款效果越准确。\n\n上传后 AI 会自动识别材质与款式信息，帮助后续生成更精准的方案。',
      icon: <Upload className="w-5 h-5 text-white" />,
    },
    {
      title: '四种改款模式',
      content: '根据需求选择改款方向：\n\n• 奢侈品色系变色 — 只改变颜色色相与饱和度，100% 保留面料细节和款式\n• 材质感知加元素 — 识别面料属性后添加兼容的工艺细节，轮廓保持一致\n• 改固定款式 — AI 在同品类内进行款式重新设计，遵循欧美审美趋势\n• 商业脑暴模式 — 完全释放 AI 创造力，生成符合流行趋势的创新方案',
      icon: <Palette className="w-5 h-5 text-white" />,
    },
    {
      title: '设置设计约束与生成数量',
      content: '在「设计约束」框中用自然语言告诉 AI：要保留什么、不要什么、方向偏好。\n\n选择生成数量（1/3/6 张），建议初期先生成 1 张看方向，满意后再追加。每张消耗 1 积分。',
      icon: <Sliders className="w-5 h-5 text-white" />,
    },
    {
      title: '查看结果与操作',
      content: '生成的结果以卡片网格展示，每张结果支持：\n\n• 对比 — 与原图滑块对比查看变化\n• 深化 — 基于某个满意方案继续生成微调变体\n• 快速工作台 — 将改款结果发送到工作台，合成上身效果图\n• 下载 — 保存到本地\n\n点击「追加方案」可批量生成更多方案（自动去重）。',
      icon: <Eye className="w-5 h-5 text-white" />,
    },
  ],

  'model-fusion': [
    {
      title: '两种工作模式',
      content: '模特工厂提供两种生成方式，通过顶部 Tab 切换：\n\n• 参数生成 — 通过类别、年龄、人种、肤色、体型等参数从零生成全新模特\n• 图片融合 — 上传 2-3 张真人照片，AI 融合面部特征成全新形象',
      icon: <Users className="w-5 h-5 text-white" />,
    },
    {
      title: '参数生成：配置模特属性',
      content: '按分类设置模特的各项属性：\n\n• 基础属性：风格类别、性别、年龄、人种\n• 身体特征：肤色、体型、身高\n• 面部与发型：脸型、发型、发色、面部细节、表情\n• 可选上传面部参考图，AI 会参考该面部特征\n• 可添加补充提示词微调最终效果',
      icon: <Sliders className="w-5 h-5 text-white" />,
    },
    {
      title: '图片融合：上传参考图并调权重',
      content: '上传 2-3 张模特参考照片后：\n\n• 拖动权重滑块控制每张参考图的贡献比例\n• 选择融合策略：\n  - 均衡融合：每张脸平均贡献\n  - 最优特征：取每人最佳五官组合\n  - 主导融合：以高权重参考图为主体\n\n每张消耗 1 积分。',
      icon: <Layers className="w-5 h-5 text-white" />,
    },
    {
      title: '发送到快速工作台',
      content: '生成/合成完成后：\n\n• 点击「发送到快速工作台」，模特图会自动注入到工作台的模特位置\n• 系统自动将结果保存到素材库（模特类型）\n• 到工作台上传服装和场景图后，一键合成上身效果大片',
      icon: <Send className="w-5 h-5 text-white" />,
    },
  ],

  history: [
    {
      title: '浏览历史记录',
      content: '所有生图任务都会在这里集中展示，包括工作台、AI 改款、模特工厂、AI 改色、一键 3D 图和生产单的结果。\n\n每条记录显示类型标签（彩色圆角标签区分来源）、状态（已完成/生成中/失败）、任务 ID 摘要、积分消耗和完成时间。',
      icon: <Clock className="w-5 h-5 text-white" />,
    },
    {
      title: '查看参考图与结果图',
      content: '每条已完成记录会展示：\n\n• 参考图片区 — 展示该任务用到的原始素材（服装、模特、场景等）\n• 结果图片区 — 以自适应网格展示所有生成结果图\n\n点击任意图片可进入拍立得预览模式，支持收藏、变高清、发送到工作台和下载操作。\n\n使用「折叠/展开」按钮可切换紧凑模式（仅显示结果图，隐藏详细信息）。',
      icon: <ImageIcon className="w-5 h-5 text-white" />,
    },
    {
      title: '批量操作',
      content: '勾选多条已完成记录后可以：\n\n• 批量对比 — 选取 2 张以上进入全屏对比模式\n• 打包下载 — 一键打包下载 ZIP 压缩包\n• 全选/取消全选 — 通过顶部「批量」菜单快速操作\n\n已选中的记录卡片会有橙色边框标识。',
      icon: <GitCompareArrows className="w-5 h-5 text-white" />,
    },
    {
      title: '高清放大与评价反馈',
      content: '• 变高清 — 鼠标悬浮结果图时右上角出现「变高清」按钮，支持 2x 超分辨率放大（消耗 1 积分），放大后的图片有绿色边框标识\n• 星级评价 — 对生成结果打分（1-5 星），帮助系统优化后续生成质量\n• 删除记录 — 不需要的记录可随时删除',
      icon: <Sparkles className="w-5 h-5 text-white" />,
    },
  ],

  favorites: [
    {
      title: '素材库概览',
      content: '素材库用来保存你常用的服装、模特、场景图片以及完整的工作台配置，方便在「快速工作台」一键复用。\n\n支持四种素材类型：\n• 服装 — 上衣、裤子等服装图片（可包含正反面）\n• 模特 — 模特参考照片\n• 场景 — 拍摄背景 / 场景图\n• 完整配置 — 整套工作台参数打包（衣服+模特+场景+输出设置）',
      icon: <Star className="w-5 h-5 text-white" />,
    },
    {
      title: '收藏素材的两种方式',
      content: '方式一：在各功能页面收藏\n• 快速工作台 — 每个上传区块右上角有「收藏」按钮，可分别收藏服装/模特/场景\n• 历史记录 — 预览图片时可点击心形图标收藏\n• 模特工厂 — 生成完成后自动保存到素材库\n\n方式二：直接上传\n• 在素材库页面点击「上传素材」按钮，选择类型后上传图片并命名保存',
      icon: <Upload className="w-5 h-5 text-white" />,
    },
    {
      title: '应用素材到工作台',
      content: '在素材库中点击任意收藏卡片的「应用」按钮：\n\n• 服装 → 注入到工作台的服装位置\n• 模特 → 注入到工作台的模特位置\n• 场景 → 注入到工作台的场景位置\n• 完整配置 → 恢复整套工作台参数（模式、比例、构图、图片等）\n\n应用后自动跳转到快速工作台页面。',
      icon: <Send className="w-5 h-5 text-white" />,
    },
  ],

  recolor: [
    {
      title: '上传服装图片',
      content: '上传你想改色的服装照片。照片越清晰、服装区域越完整，改色效果越精准。\n\n建议使用平铺或模特穿着的正面清晰照片。',
      icon: <Upload className="w-5 h-5 text-white" />,
    },
    {
      title: '在图片上取色',
      content: '点击图片上的任意位置即可拾取该点的颜色。你可以：\n\n• 从图片本身取色（如想保留某个区域的色调）\n• 通过调色板选择你想要的任意颜色\n• AI 会基于 HSV 色彩空间进行智能颜色替换，保留服装的纹理、褶皱和光影细节',
      icon: <Droplets className="w-5 h-5 text-white" />,
    },
    {
      title: '微调色彩参数',
      content: '生成后可进一步调节：\n\n• 亮度 — 控制颜色明暗程度\n• 饱和度 — 控制颜色鲜艳程度\n\n使用滑块精细调节，预览实时更新。',
      icon: <Sliders className="w-5 h-5 text-white" />,
    },
    {
      title: '对比与下载',
      content: '• 对比模式 — 使用滑块在原图和改色图之间滑动对比\n• 下载 — 满意后一键下载改色后的图片\n\n每次改色消耗 1 积分。',
      icon: <GripVertical className="w-5 h-5 text-white" />,
    },
  ],

  'ghost-mannequin': [
    {
      title: '上传服装图片',
      content: '拖拽或点击上传需要生成 3D 图的服装照片。\n\n• 建议使用正面、清晰、光照均匀的服装图片\n• AI 会自动分离服装主体，移除背景和人台/模特',
      icon: <Upload className="w-5 h-5 text-white" />,
    },
    {
      title: '选择背景风格',
      content: '提供三种背景样式：\n\n• 白底 — 纯白背景，适合电商标准图\n• 灰底 — 中性灰背景，突出服装质感\n• 自定义 — 上传你需要的背景图\n\n可选择是否开启 3D 重塑（模拟衣物立体感）和水印移除功能。',
      icon: <ImageIcon className="w-5 h-5 text-white" />,
    },
    {
      title: '生成与调节',
      content: '点击生成按钮后，AI 处理服装图片，生成干净的 3D 效果图。\n\n• 可调节亮度参数优化最终效果\n• 生成后自动显示结果，支持与原图对比查看\n• 每次生成消耗 1 积分',
      icon: <Sparkles className="w-5 h-5 text-white" />,
    },
    {
      title: '下载结果',
      content: '满意后点击下载按钮保存生成图片到本地。\n\n所有生成记录会自动保存到历史记录中，可随时回看。',
      icon: <Download className="w-5 h-5 text-white" />,
    },
  ],

  'production-sheet': [
    {
      title: '上传服装图片',
      content: '上传需要生成生产单的服装照片。\n\n建议使用清晰的正面服装图，AI 将自动分析服装的款式结构、版型特征和关键尺寸参考。',
      icon: <Upload className="w-5 h-5 text-white" />,
    },
    {
      title: 'AI 自动分析生成',
      content: '上传后 AI 会自动：\n\n• 识别服装品类与款式特征\n• 分析版型结构和关键部位\n• 自动生成 S/M/L/XL 四个尺码的规格表\n• 输出包含尺寸数据的专业生产单',
      icon: <FileText className="w-5 h-5 text-white" />,
    },
    {
      title: '查看与导出',
      content: '生成结果以卡片形式展示：\n\n• 规格表包含各尺码的详细尺寸数据\n• 支持导出为图片格式保存和打印\n• 可以通过历史记录页面回看所有生成的生产单',
      icon: <Download className="w-5 h-5 text-white" />,
    },
  ],

  profile: [
    {
      title: '账号信息与 API Key',
      content: '个人中心顶部展示你的：\n\n• 邮箱 — 登录账号\n• 角色 — 管理员或客户\n• 积分余额 — 当前可用积分\n• API Key — 点击右侧复制图标可拷贝（用于生图功能）',
      icon: <Users className="w-5 h-5 text-white" />,
    },
    {
      title: '数据统计看板',
      content: '数据统计区域展示你的使用概况：\n\n• 总生图数 / 成功率 — 了解整体生成效果\n• 总消耗 / 总充值 — 积分使用情况\n• 每日生图量趋势图 — 近 14 天每日生成图片数量\n• 每日积分消耗趋势图 — 近 14 天每日积分消耗情况',
      icon: <BarChart3 className="w-5 h-5 text-white" />,
    },
    {
      title: '积分记录',
      content: '底部表格显示所有积分变动明细：\n\n• 变动列 — 绿色向上箭头表示增加（充值/退款），红色向下箭头表示消耗（生图/放大）\n• 余额列 — 变动后的积分余额\n• 原因列 — 积分变动的具体原因说明\n• 时间列 — 变动发生的时间\n\n如需充值请联系管理员。',
      icon: <Coins className="w-5 h-5 text-white" />,
    },
  ],
}

export const TUTORIAL_MODULES: TutorialModule[] = [
  {
    key: 'quick-workspace',
    title: '快速工作台',
    description: '上传衣服 + 模特 + 场景图，一键合成街拍级服装上身效果',
    icon: <Wand2 className="w-5 h-5 text-white" />,
    color: '#c67b5c',
    steps: TUTORIALS['quick-workspace'],
  },
  {
    key: 'redesign',
    title: 'AI 改款',
    description: '上传服装原图，AI 批量生成变色/加元素/改款式/脑暴等全新设计方案',
    icon: <Sparkles className="w-5 h-5 text-white" />,
    color: '#b0654a',
    steps: TUTORIALS.redesign,
  },
  {
    key: 'model-fusion',
    title: '模特工厂',
    description: '参数生成或图片融合，创建全新的 AI 模特形象并发送到工作台',
    icon: <Users className="w-5 h-5 text-white" />,
    color: '#8b7355',
    steps: TUTORIALS['model-fusion'],
  },
  {
    key: 'history',
    title: '历史记录',
    description: '查看所有生图任务，支持批量对比、打包下载、高清放大和评价反馈',
    icon: <Clock className="w-5 h-5 text-white" />,
    color: '#7d9b76',
    steps: TUTORIALS.history,
  },
  {
    key: 'favorites',
    title: '素材库',
    description: '管理收藏的服装、模特、场景素材及完整配置，在快速工作台一键复用',
    icon: <Star className="w-5 h-5 text-white" />,
    color: '#d4a06a',
    steps: TUTORIALS.favorites,
  },
  {
    key: 'recolor',
    title: 'AI 改色',
    description: '点选任意颜色，AI 智能替换服装色彩，保留纹理与光影细节',
    icon: <Palette className="w-5 h-5 text-white" />,
    color: '#6366f1',
    steps: TUTORIALS.recolor,
  },
  {
    key: 'ghost-mannequin',
    title: '一键 3D 图',
    description: '上传服装图片，AI 自动移除背景生成 3D 展示图，支持白底/灰底/自定义背景',
    icon: <Box className="w-5 h-5 text-white" />,
    color: '#c67b5c',
    steps: TUTORIALS['ghost-mannequin'],
  },
  {
    key: 'production-sheet',
    title: '生产单',
    description: '上传服装图片，AI 自动生成 S/M/L/XL 规格尺码表，支持导出打印',
    icon: <FileText className="w-5 h-5 text-white" />,
    color: '#8b7355',
    steps: TUTORIALS['production-sheet'],
  },
  {
    key: 'profile',
    title: '个人中心',
    description: '查看账号信息、数据统计看板与积分变动记录',
    icon: <Users className="w-5 h-5 text-white" />,
    color: '#6b5d4f',
    steps: TUTORIALS.profile,
  },
]
