import type { ModelConfig } from './types'

const ETHNICITY_LABEL: Record<string, string> = {
  Chinese: 'Chinese',
  American: 'American',
  British: 'British',
  French: 'French',
  Korean: 'Korean',
  Japanese: 'Japanese',
  Indian: 'Indian',
  Thai: 'Thai',
  Brazilian: 'Brazilian',
  Russian: 'Russian',
  Italian: 'Italian',
  Spanish: 'Spanish',
  Middle_Eastern: 'Middle Eastern',
  African: 'African',
  Southeast_Asian: 'Southeast Asian',
  Mixed: 'mixed-race',
}

/** 与前台「类别」选项对应的英文段落，供生图模型与接口 JSON 使用 */
export function getModelCategoryStyleParagraph(category: string): string {
  const map: Record<string, string> = {
    supermodel:
      'High-fashion editorial supermodel casting: elongated elegant proportions, refined symmetrical bone structure, pronounced cheekbones, ' +
      'confident magazine-cover presence, glossy healthy hair suited to luxury campaigns, polished yet believable grooming, ' +
      'luminous skin with realistic microtexture—runway-level beauty that still reads as a real photograph, not plastic or CGI.',
    kardashian:
      'Kardashian-inspired glamorous beauty: curvaceous hourglass silhouette, full lips, dramatic contoured makeup, voluminous styled hair, ' +
      'confident sultry gaze, luxury street-luxe aesthetic—always photoreal, never illustration-like.',
    sweet_cool:
      'Sweet-cool (甜酷) girl-crush style: edgy yet cute, sharp jawline with soft features, bold eye makeup mixed with glossy lips, ' +
      'confident and slightly rebellious attitude, streetwear-meets-high-fashion energy, youthful and trendy.',
    intellectual:
      'Intellectual refined beauty: poised and thoughtful expression, clean elegant bone structure, understated grooming, ' +
      'scholarly warmth in the eyes, quiet confidence—think modern literary heroine or young professional.',
    fresh:
      'Fresh pure beauty (清纯风): youthful dewy skin, minimal to no makeup, bright clear eyes, naturally flushed cheeks, ' +
      'innocent and approachable aura, soft natural lighting sensibility.',
    sporty:
      'Athletic sporty beauty: healthy glowing skin, toned physique visible even in simple clothing, energetic and confident posture, ' +
      'natural windswept hair, minimal makeup highlighting natural features, active lifestyle aesthetic.',
    vintage:
      'Vintage retro beauty: classic Hollywood or 60s/70s-inspired styling, defined brows, red or berry lips, elegant waves or curls, ' +
      'timeless sophisticated glamour with a nostalgic mood.',
    high_street:
      'High-street commercial model: versatile approachable look, clean and polished but not overly editorial, ' +
      'natural beauty that works for mainstream fashion campaigns, balanced proportions, warm inviting presence.',
  }
  return map[category] ?? (
    'Natural "everyday" street-style casting: relatable proportions and authentic approachable beauty, soft candid energy, ' +
    'minimal retouching sensibility—visible pores and subtle imperfections are welcome so the subject feels like a real person on the street, not a cold runway mannequin.'
  )
}

export function getEthnicityLabel(ethnicity: string): string {
  return ETHNICITY_LABEL[ethnicity] || ethnicity || 'American'
}

export function getModelGenderDescriptor(gender: string): string {
  if (gender === 'male') return 'man'
  if (gender === 'androgynous') return 'person with refined androgynous features'
  return 'woman'
}

export function getModelSkinTonePhrase(skinTone: string): string {
  const map: Record<string, string> = {
    porcelain: 'porcelain-white translucent complexion with delicate veins visible, cool pink undertones',
    fair: 'fair complexion with soft natural undertones and realistic skin microtexture',
    light: 'light warm complexion with subtle golden undertones and peachy cheeks',
    natural: 'natural balanced skin tone with healthy realistic texture',
    olive: 'olive-toned Mediterranean complexion with warm golden undertones',
    tan: 'sun-kissed warm tan complexion with healthy bronzed glow',
    caramel: 'rich caramel complexion with warm amber undertones and natural glow',
    deep: 'deep rich skin tone with natural highlights and realistic texture',
    ebony: 'deep ebony complexion with cool blue-black undertones and luminous sheen',
  }
  return map[skinTone] ?? map.natural
}

export function getModelBodyTypePhrase(bodyType: string): string {
  const map: Record<string, string> = {
    petite: 'a petite compact frame with delicate proportions',
    slim: 'a slim editorial silhouette with long graceful lines',
    athletic: 'an athletic toned build with healthy muscle definition',
    average: 'an average natural build with balanced proportions',
    curvy: 'a curvy hourglass silhouette with soft feminine curves',
    plus: 'a plus-size build with confident full-figured proportions',
    muscular: 'a muscular well-built physique with prominent muscle definition',
  }
  return map[bodyType] ?? map.slim
}

export function getModelHeightPhrase(height?: string): string {
  const map: Record<string, string> = {
    petite: 'petite stature (around 155cm/5\'1")',
    short: 'below-average height (around 160cm/5\'3")',
    medium: 'medium height (around 165cm/5\'5")',
    tall: 'tall stature (around 172cm/5\'8")',
    very_tall: 'very tall model height (around 178cm/5\'10"+)',
  }
  return height ? (map[height] ?? '') : ''
}

export function getModelFaceShapePhrase(faceShape?: string): string {
  const map: Record<string, string> = {
    oval: 'oval face shape with balanced proportions',
    round: 'round soft face shape with full cheeks',
    heart: 'heart-shaped face with wider forehead tapering to a delicate chin',
    square: 'square face shape with strong jawline and angular features',
    diamond: 'diamond face shape with prominent cheekbones and narrow forehead/chin',
    oblong: 'oblong elongated face shape with long proportions',
    v_shaped: 'V-shaped face with sharp chin and defined jawline (Korean beauty ideal)',
  }
  return faceShape ? (map[faceShape] ?? '') : ''
}

export function getModelHairPhrase(hairStyle?: string, hairColor?: string): string {
  const styleMap: Record<string, string> = {
    straight_long: 'long straight hair',
    straight_medium: 'medium-length straight hair',
    straight_short: 'short straight hair',
    wavy_long: 'long wavy hair with natural movement',
    wavy_medium: 'medium-length wavy hair',
    curly_long: 'long curly hair with defined curls',
    curly_short: 'short curly hair with bouncy texture',
    bob: 'a sleek bob cut at chin length',
    lob: 'a long bob (lob) cut at shoulder length',
    pixie: 'a short pixie cut',
    bangs_straight: 'straight hair with blunt bangs',
    bangs_curtain: 'hair with soft curtain bangs framing the face',
    ponytail_high: 'hair pulled up in a high ponytail',
    ponytail_low: 'a low relaxed ponytail',
    bun_high: 'hair in a neat high bun',
    bun_messy: 'a messy casual bun',
    braids: 'braided hair',
    half_up: 'half-up half-down hairstyle',
    side_part: 'side-parted hair swept to one side',
    center_part: 'center-parted hair',
    wet_look: 'slicked-back wet-look hair',
    afro: 'natural afro-textured hair',
    shaved: 'a shaved/buzzcut hairstyle',
  }
  const colorMap: Record<string, string> = {
    black: 'jet black',
    dark_brown: 'dark brown',
    brown: 'medium brown',
    light_brown: 'light brown / chestnut',
    blonde: 'blonde',
    platinum: 'platinum blonde / silver',
    red: 'auburn red',
    ginger: 'ginger copper',
    honey: 'warm honey blonde',
    ash: 'cool ash brown',
    ombre: 'ombré gradient (dark roots to lighter ends)',
    highlights: 'natural base with sun-kissed highlights',
    pink: 'pastel pink',
    blue: 'cool blue',
    gray: 'natural gray / silver',
  }
  const parts: string[] = []
  if (hairColor && colorMap[hairColor]) parts.push(colorMap[hairColor])
  if (hairStyle && styleMap[hairStyle]) parts.push(styleMap[hairStyle])
  if (parts.length === 0) return ''
  return `Hair: ${parts.join(', ')}.`
}

/** 年龄、人种、性别、肤色、体型、脸型、发型、妆造（不含类别气质段、不含姿势表情） */
export function buildModelCorePhysical(modelConfig: ModelConfig): string {
  const ethnicity = getEthnicityLabel(modelConfig.ethnicity)
  const genderDesc = getModelGenderDescriptor(modelConfig.gender)
  const skinDesc = getModelSkinTonePhrase(modelConfig.skinTone)
  const bodyDesc = getModelBodyTypePhrase(modelConfig.bodyType)
  const heightDesc = getModelHeightPhrase(modelConfig.height)
  const faceShapeDesc = getModelFaceShapePhrase(modelConfig.faceShape)
  const hairDesc = getModelHairPhrase(modelConfig.hairStyle, modelConfig.hairColor)
  const faceFeaturePart = modelConfig.faceFeature ? ` Additional facial styling: ${modelConfig.faceFeature}.` : ''

  let base = `${modelConfig.age} years old, ${ethnicity} ${genderDesc}, with ${skinDesc}, and ${bodyDesc}.`
  if (heightDesc) base += ` ${heightDesc}.`
  if (faceShapeDesc) base += ` ${faceShapeDesc}.`
  if (hairDesc) base += ` ${hairDesc}`
  base += faceFeaturePart
  return base
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
