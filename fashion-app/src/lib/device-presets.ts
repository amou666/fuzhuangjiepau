/**
 * 快速工作台 · 拍摄模式（shooting modes）
 *
 * 4 种模式（+自动）：
 *   - 自动：不注入摄影后缀，由 AI 自行决定
 *   - 手机通用（phone）：手机自拍/朋友拍的随意抓拍感
 *   - 单反远景（dslr-wide）：24mm 环境纪录，模特小占比
 *   - 单反中景（dslr-medium）：50mm，浅景深主体突出
 *   - 单反近景（dslr-close）：85mm，肖像级浅景深
 *
 * promptFragment 使用用户指定的英文后缀，直接拼接到图像合成 prompt。
 *
 * 本文件同时被前端（UI）与后端（prompt）引用，保持纯数据。
 */

export type QuickWorkspaceDeviceId =
  | 'auto'
  | 'phone'
  | 'dslr-wide'
  | 'dslr-medium'
  | 'dslr-close'

export type QuickWorkspaceDeviceKind = 'auto' | 'phone' | 'dslr'

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
  /** 最终图像合成 prompt 注入的摄影语言后缀（直接英文） */
  promptFragment: string
}

const AUTO: DevicePreset = {
  id: 'auto',
  kind: 'auto',
  label: '自动',
  specLine: '不指定拍摄模式',
  desc: '由 AI 根据场景自主决定拍摄方式，不强制焦距、景深与构图节奏。',
  framingBias: 'auto',
  promptFragment: '',
}

const PRESETS: DevicePreset[] = [
  // ─── 手机 ──────────────────────────────────────────────────
  {
    id: 'phone',
    kind: 'phone',
    label: '手机通用',
    specLine: '26mm 主摄 · 生活抓拍',
    desc: '手机朋友拍/自拍感：随意构图、轻微抓拍、真实肌理、生活氛围。',
    framingBias: 'auto',
    promptFragment: [
      'shot on iPhone 16, 26mm lens, Apple ProRAW photo,',
      'natural ambient lighting, slightly uneven exposure,',
      'subtle highlights slightly overexposed, soft shadows,',
      'candid moment, unposed, slightly off-center composition, casual framing,',
      'mild motion blur, slight camera shake,',
      'fine grain noise, realistic texture,',
      'imperfect skin details, visible pores,',
      'lens distortion, slight chromatic aberration,',
      'background slightly messy and organic,',
      'real-life atmosphere, everyday snapshot feeling',
    ].join(' '),
  },

  // ─── 单反 ──────────────────────────────────────────────────
  {
    id: 'dslr-wide',
    kind: 'dslr',
    label: '单反远景',
    specLine: '24mm · f/2.8 · 环境纪录',
    desc: '广角远景，模特小占比，环境感最强，纪录片气质。',
    framingBias: 'full',
    promptFragment: [
      'shot on DSLR, 24mm wide-angle lens,',
      'f/2.8 aperture, deep environmental perspective,',
      'subject small in frame,',
      'natural ambient light, slightly uneven exposure,',
      'candid moment, documentary style,',
      'slight motion blur, natural shadows,',
      'film-like grain, realistic color tone,',
      'unpolished composition, real-life atmosphere',
    ].join(' '),
  },
  {
    id: 'dslr-medium',
    kind: 'dslr',
    label: '单反中景',
    specLine: '50mm · f/1.8 · 主体突出',
    desc: '标准焦距中景，主体锐利、背景柔化，抓拍松弛感。',
    framingBias: 'half',
    promptFragment: [
      'shot on DSLR, 50mm lens,',
      'f/1.8 aperture, shallow depth of field,',
      'subject in focus, background softly blurred,',
      'natural light, soft shadows,',
      'candid pose, not looking at camera,',
      'slightly off-center composition,',
      'fine skin texture, realistic imperfections,',
      'subtle grain, natural color grading',
    ].join(' '),
  },
  {
    id: 'dslr-close',
    kind: 'dslr',
    label: '单反近景',
    specLine: '85mm · f/1.4 · 肖像特写',
    desc: '长焦近景，极浅景深，奶油焦外、眼神锐利，杂志人像质感。',
    framingBias: 'half',
    promptFragment: [
      'shot on DSLR, 85mm lens,',
      'f/1.4 aperture, very shallow depth of field,',
      'sharp focus on eyes, creamy background bokeh,',
      'cinematic natural lighting,',
      'high detail skin texture, visible pores,',
      'subtle imperfections, realistic shadows,',
      'slight lens breathing, soft highlight roll-off',
    ].join(' '),
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
/** 单反模式分组（UI 用） */
export const CAMERA_PRESETS: ReadonlyArray<DevicePreset> = PRESETS.filter((p) => p.kind === 'dslr')
/** 手机模式分组（UI 用） */
export const PHONE_PRESETS: ReadonlyArray<DevicePreset> = PRESETS.filter((p) => p.kind === 'phone')

export function isValidDeviceId(value: unknown): value is QuickWorkspaceDeviceId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRESET_MAP, value)
}

export function getDevicePreset(id: QuickWorkspaceDeviceId | string | undefined | null): DevicePreset {
  if (id && isValidDeviceId(id)) return PRESET_MAP[id]
  return AUTO
}

/**
 * 根据用户选的构图意图 + 模式推荐构图，融合出最终 framing。
 * 用户显式选了 half/full 则尊重用户，选 auto 才用模式偏好。
 */
export function resolveFramingBias(
  userFraming: QuickWorkspaceFramingBias | undefined,
  deviceId: QuickWorkspaceDeviceId | string | undefined | null,
): QuickWorkspaceFramingBias {
  if (userFraming === 'full' || userFraming === 'half') return userFraming
  const preset = getDevicePreset(deviceId)
  return preset.framingBias
}
