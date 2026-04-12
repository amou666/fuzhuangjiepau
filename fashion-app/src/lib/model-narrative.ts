import type { ModelConfig } from './types'

const ETHNICITY_LABEL: Record<string, string> = {
  Chinese: 'Chinese',
  American: 'American',
  British: 'British',
  French: 'French',
  Korean: 'Korean',
  Japanese: 'Japanese',
  Indian: 'Indian',
}

/** 与前台「类别」选项对应的英文段落，供生图模型与接口 JSON 使用 */
export function getModelCategoryStyleParagraph(category: string): string {
  if (category === 'supermodel') {
    return (
      'High-fashion editorial supermodel casting: elongated elegant proportions, refined symmetrical bone structure, pronounced cheekbones, ' +
      'confident magazine-cover presence, glossy healthy hair suited to luxury campaigns, polished yet believable grooming, ' +
      'luminous skin with realistic microtexture—runway-level beauty that still reads as a real photograph, not plastic or CGI.'
    )
  }
  if (category === 'kardashian') {
    return (
      'Kardashian-inspired glamorous beauty: curvaceous hourglass silhouette, full lips, dramatic contoured makeup, voluminous styled hair, ' +
      'confident sultry gaze, luxury street-luxe aesthetic—always photoreal, never illustration-like.'
    )
  }
  return (
    'Natural “everyday” street-style casting: relatable proportions and authentic approachable beauty, soft candid energy, ' +
    'minimal retouching sensibility—visible pores and subtle imperfections are welcome so the subject feels like a real person on the street, not a cold runway mannequin.'
  )
}

export function getEthnicityLabel(ethnicity: string): string {
  return ETHNICITY_LABEL[ethnicity] || 'American'
}

export function getModelGenderDescriptor(gender: string): string {
  if (gender === 'male') return 'man'
  if (gender === 'androgynous') return 'person with refined androgynous features'
  return 'woman'
}

export function getModelSkinTonePhrase(skinTone: string): string {
  const map: Record<string, string> = {
    fair: 'fair complexion with soft natural undertones and realistic skin microtexture',
    natural: 'natural balanced skin tone with healthy realistic texture',
    deep: 'deep rich skin tone with natural highlights and realistic texture',
  }
  return map[skinTone] ?? map.natural
}

export function getModelBodyTypePhrase(bodyType: string): string {
  const map: Record<string, string> = {
    slim: 'a slim editorial silhouette with long graceful lines',
    athletic: 'an athletic toned build with healthy muscle definition',
    curvy: 'a curvy hourglass silhouette with soft feminine curves',
  }
  return map[bodyType] ?? map.slim
}

/** 年龄、人种、性别、肤色、体型、妆造（不含类别气质段、不含姿势表情） */
export function buildModelCorePhysical(modelConfig: ModelConfig): string {
  const ethnicity = getEthnicityLabel(modelConfig.ethnicity)
  const genderDesc = getModelGenderDescriptor(modelConfig.gender)
  const skinDesc = getModelSkinTonePhrase(modelConfig.skinTone)
  const bodyDesc = getModelBodyTypePhrase(modelConfig.bodyType)
  const faceFeaturePart = modelConfig.faceFeature ? ` Additional facial styling: ${modelConfig.faceFeature}.` : ''
  return `${modelConfig.age} years old, ${ethnicity} ${genderDesc}, with ${skinDesc}, and ${bodyDesc}.${faceFeaturePart}`
}

export function appendPoseAndExpression(modelConfig: ModelConfig): string {
  const posePart = modelConfig.pose?.trim()
    ? ` Pose and body language: ${modelConfig.pose.trim()}.`
    : ''
  const expressionPart = modelConfig.expression?.trim()
    ? ` Facial expression: ${modelConfig.expression.trim()}.`
    : ''
  return `${posePart}${expressionPart}`
}

const UPLOAD_FACE_NOTE =
  ' Face and hair from the uploaded model reference will be analyzed by AI when the task runs.'

/**
 * 写入 modelConfig.castingNarrative / 前端 JSON 预览。
 * 与 AIService.describeModel 中「静态部分」一致；上传模特图时面部句由任务运行时补全。
 */
export function buildModelCastingNarrativeForPayload(
  modelConfig: ModelConfig,
  sceneMode: 'preset' | 'replace' = 'preset'
): string {
  const categoryStyle = getModelCategoryStyleParagraph(modelConfig.category)
  const corePhysical = buildModelCorePhysical(modelConfig)
  const base = `Casting direction: ${categoryStyle} Subject details: ${corePhysical}`

  if (sceneMode === 'replace') {
    if (modelConfig.mode === 'upload' && modelConfig.imageUrl) {
      return `${base}${UPLOAD_FACE_NOTE}`.trim()
    }
    return base.trim()
  }

  if (modelConfig.mode === 'upload' && modelConfig.imageUrl) {
    return `${base}${UPLOAD_FACE_NOTE}${appendPoseAndExpression(modelConfig)}`.trim()
  }
  return `${base}${appendPoseAndExpression(modelConfig)}`.trim()
}

export function mergeModelConfigWithCastingNarrative(
  modelConfig: ModelConfig,
  sceneMode: 'preset' | 'replace'
): ModelConfig {
  return {
    ...modelConfig,
    castingNarrative: buildModelCastingNarrativeForPayload(modelConfig, sceneMode),
  }
}
