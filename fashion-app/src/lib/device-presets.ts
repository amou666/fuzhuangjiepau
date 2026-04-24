/**
 * 快速工作台 · 拍摄设备预设
 *
 * 设备 → 焦距 / 光圈 / 景深 / 焦外 / 透视 / 出片风格
 * 每个设备的 promptFragment 会被注入到图像合成 prompt，让 AI 生成对应器材的真实成片。
 *
 * 这个文件同时被前端（UI 展示）和后端（prompt 构造）引用。
 * 保持纯数据 + 纯函数，无 Node / 浏览器特定依赖。
 */

export type QuickWorkspaceDeviceId =
  | 'auto'
  | 'leica-m-50-f14'
  | 'canon-r-85-f18'
  | 'sony-a7-35-f2'
  | 'hasselblad-mf-80'
  | 'fujifilm-film-35'
  | 'iphone-16-pro'
  | 'huawei-pura-70-pro'
  | 'xiaomi-14-ultra'

export type QuickWorkspaceDeviceKind = 'auto' | 'camera' | 'phone'

export type QuickWorkspaceFramingBias = 'auto' | 'half' | 'full'

export interface DevicePreset {
  id: QuickWorkspaceDeviceId
  kind: QuickWorkspaceDeviceKind
  /** 卡片主标题 */
  label: string
  /** 卡片副标题（简短规格） */
  specLine: string
  /** 卡片描述 */
  desc: string
  /** 推荐构图：当用户选 framing=auto 时用这个兜底 */
  framingBias: QuickWorkspaceFramingBias
  /** 背景/位置分析阶段的提示（告诉布局 AI 该设备的最佳拍摄距离与构图） */
  placementHint: string
  /** 最终图像合成阶段注入的摄影语言（详尽描述器材、焦距、景深、焦外、成像风格） */
  promptFragment: string
}

const AUTO: DevicePreset = {
  id: 'auto',
  kind: 'auto',
  label: '自动',
  specLine: '不指定器材',
  desc: '由 AI 根据场景自主决定拍摄方式，不强制焦距和景深。',
  framingBias: 'auto',
  placementHint: '',
  promptFragment: '',
}

const PRESETS: DevicePreset[] = [
  // ─── 相机 ────────────────────────────────────────────────────
  {
    id: 'leica-m-50-f14',
    kind: 'camera',
    label: '徕卡 M · 50mm f/1.4',
    specLine: '全画幅 · 50mm · f/1.4 · RAW',
    desc: '经典人像标准定焦：通透肤色、自然视角、中等浅景深焦外柔美。',
    framingBias: 'auto',
    placementHint:
      '器材倾向：徕卡 M 机身 + 50mm 定焦标准镜头。最佳拍摄距离约 1.8–2.8m，取景接近人眼自然透视，适合全身或三分之二身构图，避免大头特写。',
    promptFragment: [
      '【拍摄器材】Leica M 系列全画幅旁轴 + Summilux 50mm f/1.4 ASPH 标准定焦镜头；光圈 f/1.4，ISO 200，1/500s 左右。',
      '【透视与距离】50mm 标准焦距，视角与人眼接近、无明显透视变形；模特与相机距离约 1.8–2.8m。',
      '【景深与焦外】f/1.4 浅景深：模特脸部至躯干锐利，背景明显柔化但保留辨识度（非糊成一片），高光呈圆形柔和光斑，焦外过渡平滑通透（非计算模糊）。',
      '【取景】全身或三分之二身构图为主，避免大头特写。',
      '【成像风格】徕卡标志性：肤色通透偏暖、暗部细节保留、微对比、轻微胶片感色彩、极低噪点；整体呈现高素质 RAW 直出质感，不做过度磨皮与计算合成。',
    ].join('\n'),
  },
  {
    id: 'canon-r-85-f18',
    kind: 'camera',
    label: '佳能 R · 85mm f/1.8',
    specLine: '全画幅 · 85mm · f/1.8 · 人像神镜',
    desc: '中长焦人像镜：奶油焦外、空间压缩感强、脸型更立体。',
    framingBias: 'half',
    placementHint:
      '器材倾向：佳能 EOS R 系列 + RF 85mm f/1.8 中长焦人像镜头。最佳拍摄距离约 2.5–3.5m，强空间压缩、背景明显虚化；推荐半身 / 三分之二身构图，不做全身广角。',
    promptFragment: [
      '【拍摄器材】Canon EOS R5/R6 全画幅无反 + RF 85mm f/1.8 IS STM 中长焦人像镜头；光圈 f/1.8，ISO 100–200，1/250s。',
      '【透视与距离】85mm 中长焦：显著压缩远近空间、脸部比例更立体、无广角畸变；拍摄距离约 2.5–3.5m。',
      '【景深与焦外】f/1.8 大光圈浅景深：模特眼睫毛到下颌锐利，衣服纹理开始微虚，背景呈奶油般柔化焦外（creamy bokeh），高光散射成柔和圆形光斑。',
      '【取景】半身或三分之二身人像为主；禁止做广角全身。',
      '【成像风格】佳能全画幅标志性肤色——红润通透、偏暖、油润过渡；高动态范围、细节锐利、噪点极低；整体呈现商业杂志人像质感。',
    ].join('\n'),
  },
  {
    id: 'sony-a7-35-f2',
    kind: 'camera',
    label: '索尼 A7 · 35mm f/2',
    specLine: '全画幅 · 35mm · f/2 · 人文街拍',
    desc: '人文街拍视角：轻广角、保留环境氛围、景深适中。',
    framingBias: 'full',
    placementHint:
      '器材倾向：索尼 A7 系列 + 35mm f/2 广角定焦，人文纪实风格。最佳拍摄距离约 1.2–2.0m，画面带有一定环境空间；推荐全身或三分之二身构图，画面里保留场景元素作为氛围。',
    promptFragment: [
      '【拍摄器材】Sony α7 IV 全画幅无反 + FE 35mm f/1.8 G 广角定焦；光圈 f/2，ISO 100–400，1/500s。',
      '【透视与距离】35mm 轻广角：环境感强，画面边缘可见自然广角延展（但不夸张）；拍摄距离约 1.2–2.0m。',
      '【景深与焦外】f/2 适中浅景深：模特全身清晰，背景柔化程度中等——辨识度保留、不呈奶油焦外；前景物体基本清晰。',
      '【取景】全身或三分之二身，画面中必须包含明显的场景元素（建筑、街道、光斑等）作为氛围。',
      '【成像风格】索尼标志性通透与锐利：高解析力、细节丰富、色彩中性偏冷、阴影层次清晰；整体呈现人文纪实街拍风格，不做过度修饰。',
    ].join('\n'),
  },
  {
    id: 'hasselblad-mf-80',
    kind: 'camera',
    label: '哈苏中画幅 · 80mm',
    specLine: '中画幅 · 80mm · f/2.8 · 商业大片',
    desc: '中画幅商业级：极高细节、肤色丝滑、动态范围顶级。',
    framingBias: 'half',
    placementHint:
      '器材倾向：哈苏 X 系列中画幅无反 + XCD 80mm f/1.9 标准镜。拍摄距离约 2.5–3m，等效 50mm 视角；推荐半身或三分之二身大片构图，注重布光。',
    promptFragment: [
      '【拍摄器材】Hasselblad X2D 100C 中画幅无反 + XCD 80mm f/1.9 标准镜（等效全画幅约 55mm）；光圈 f/2.8，ISO 64，1/200s。',
      '【透视与距离】中画幅 80mm 接近标准焦距：视角自然、几乎无畸变；拍摄距离约 2.5–3m。',
      '【景深与焦外】f/2.8 + 中画幅大底：浅景深但比全画幅 f/2.8 更明显，焦外过渡极其细腻，立体层次感强。',
      '【取景】半身或三分之二身商业人像；注重布光层次。',
      '【成像风格】哈苏 Natural Colour Solution：肤色从明到暗过渡极其平滑、毛孔/布料纹理高度清晰、动态范围顶级（高光不过曝、阴影可提亮）、噪点几乎不可见；整体呈现 Vogue / 时装广告级商业大片质感。',
    ].join('\n'),
  },
  {
    id: 'fujifilm-film-35',
    kind: 'camera',
    label: '富士胶片 · 35mm',
    specLine: 'Kodak Portra 400 胶卷',
    desc: '胶片质感：暖色调、颗粒、轻微偏色、生活街拍感。',
    framingBias: 'full',
    placementHint:
      '器材倾向：富士胶片机（类似 X100V / Klasse W）+ 35mm 定焦 + Kodak Portra 400 胶卷质感。拍摄距离 1.2–2m，全身或三分之二身生活街拍感。',
    promptFragment: [
      '【拍摄器材】35mm 胶片单反 / 旁轴 + 35mm 定焦 + Kodak Portra 400 彩色负片（或 Fuji 400H）。',
      '【透视与距离】35mm 标准街拍视角；拍摄距离约 1.2–2m。',
      '【景深与焦外】f/2.8–f/4 胶片景深：主体清晰，背景柔化但保留辨识度；焦外为光学模糊（非计算模糊），不带奶油感。',
      '【取景】全身或三分之二身，画面构图松弛、带生活感。',
      '【成像风格】真实胶片成像：可见均匀细腻颗粒（颗粒大小类 Portra 400），肤色偏粉偏暖、绿色略偏青、阴影略带洋红偏色；动态范围比数码低（高光柔和过曝、阴影压缩）；整体呈现 90s–2000s 生活街拍胶片感，避免干净数码质感。',
    ].join('\n'),
  },

  // ─── 手机 ────────────────────────────────────────────────────
  {
    id: 'iphone-16-pro',
    kind: 'phone',
    label: 'iPhone 16 Pro',
    specLine: '主摄 24mm · f/1.78 · 人像模式',
    desc: '手机自拍/朋友拍：HDR 合成感、肤色通透偏暖、边缘略广角。',
    framingBias: 'auto',
    placementHint:
      '器材倾向：iPhone 16 Pro 主摄 24mm，拍摄距离较近约 0.8–1.5m。画面带轻微广角延展感；拍摄者与模特空间亲密，生活朋友圈感。',
    promptFragment: [
      '【拍摄器材】iPhone 16 Pro 主摄（约等效 24mm，f/1.78，1/1.28" 传感器），启用人像模式（算法景深）。',
      '【透视与距离】主摄接近广角：画面边缘可见轻微广角延展、靠近主体时脸部会略微放大变形；拍摄距离约 0.8–1.5m。',
      '【景深与焦外】人像模式算法景深：主体边缘清晰、背景模糊程度中等，焦外边缘偶有轻微算法瑕疵（非光学焦外），前景通常也清晰。',
      '【取景】半身或全身均可，允许出现自拍/朋友拍视角，画面略偏随意。',
      '【成像风格】iPhone 典型计算摄影：HDR 多帧合成（高光阴影都拉回）、肤色通透偏暖、细节锐利度高、整体干净低噪点；有轻微计算合成感（阴影略抬亮、对比度偏高）。',
    ].join('\n'),
  },
  {
    id: 'huawei-pura-70-pro',
    kind: 'phone',
    label: '华为 Pura 70 Pro',
    specLine: '徕卡认证 · 可变光圈 f/1.4-4.0',
    desc: '徕卡调色：偏冷对比、阴影压暗、细节锐利。',
    framingBias: 'auto',
    placementHint:
      '器材倾向：华为 Pura 70 Pro 主摄，徕卡风格调色。拍摄距离 1–1.5m，画面风格偏冷偏对比。',
    promptFragment: [
      '【拍摄器材】Huawei Pura 70 Pro 主摄（徕卡认证，等效 23mm，可变光圈 f/1.4–f/4.0，1/1.3" 传感器）；使用「徕卡经典」色彩模式。',
      '【透视与距离】主摄略广角，拍摄距离约 1–1.5m；边缘有轻微广角延展感。',
      '【景深与焦外】f/1.8–f/2.0 光学景深：主体清晰、背景柔化程度中等，焦外相对自然（比计算景深更像真实光学模糊）。',
      '【取景】半身或全身均可，画面带徕卡经典的庄重感。',
      '【成像风格】徕卡调色：阴影压暗、高光保留、色彩偏冷且高对比（黑得深、白得净）、画面氛围沉稳；细节锐利、噪点控制优秀；整体呈现德味街拍感。',
    ].join('\n'),
  },
  {
    id: 'xiaomi-14-ultra',
    kind: 'phone',
    label: '小米 14 Ultra · 徕卡',
    specLine: '1 英寸大底 · 徕卡 Summilux',
    desc: '大底手机 + 徕卡光学：接近相机焦外、色彩通透。',
    framingBias: 'half',
    placementHint:
      '器材倾向：小米 14 Ultra 主摄 1 英寸大底 + 徕卡 Summilux 镜头。拍摄距离 1.2–2m，接近相机质感；推荐半身构图。',
    promptFragment: [
      '【拍摄器材】Xiaomi 14 Ultra 主摄：1 英寸索尼 LYT-900 传感器 + 徕卡 Summilux 镜头（等效 23mm，可变光圈 f/1.63–f/4.0）；使用「徕卡生动」色彩模式。',
      '【透视与距离】主摄轻广角，拍摄距离约 1.2–2m。',
      '【景深与焦外】f/1.63 大光圈 + 1 英寸大底：浅景深接近小型相机，背景柔化明显且焦外圆润；算法干预较少。',
      '【取景】半身或三分之二身为主，兼具手机便携感与相机质感。',
      '【成像风格】徕卡生动调色：色彩饱和通透、红色偏朱砂、绿色浓郁、阴影保留细节；画面整体通透、锐度适中、轻微胶片氛围；比一般手机更接近相机直出质感。',
    ].join('\n'),
  },
]

const ALL_DEVICES: DevicePreset[] = [AUTO, ...PRESETS]

const PRESET_MAP: Record<string, DevicePreset> = ALL_DEVICES.reduce(
  (acc, p) => {
    acc[p.id] = p
    return acc
  },
  {} as Record<string, DevicePreset>,
)

export const DEVICE_PRESETS: ReadonlyArray<DevicePreset> = ALL_DEVICES
export const DEVICE_IDS: ReadonlyArray<QuickWorkspaceDeviceId> = ALL_DEVICES.map((p) => p.id) as QuickWorkspaceDeviceId[]
export const CAMERA_PRESETS: ReadonlyArray<DevicePreset> = PRESETS.filter((p) => p.kind === 'camera')
export const PHONE_PRESETS: ReadonlyArray<DevicePreset> = PRESETS.filter((p) => p.kind === 'phone')

export function isValidDeviceId(value: unknown): value is QuickWorkspaceDeviceId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRESET_MAP, value)
}

export function getDevicePreset(id: QuickWorkspaceDeviceId | string | undefined | null): DevicePreset {
  if (id && isValidDeviceId(id)) return PRESET_MAP[id]
  return AUTO
}

/**
 * 根据用户选的构图意图 + 设备推荐构图，融合出最终 framing。
 * 用户显式选了 half/full 则尊重用户，选 auto 才用设备偏好。
 */
export function resolveFramingBias(
  userFraming: QuickWorkspaceFramingBias | undefined,
  deviceId: QuickWorkspaceDeviceId | string | undefined | null,
): QuickWorkspaceFramingBias {
  if (userFraming === 'full' || userFraming === 'half') return userFraming
  const preset = getDevicePreset(deviceId)
  return preset.framingBias
}
