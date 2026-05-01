import fs from 'fs/promises'
import path from 'path'
import { Agent, ProxyAgent, fetch as undiciFetch } from 'undici'
import { config, getUploadPath } from './config'
import { db } from './db'
import { getActiveAnalysisModel, getActiveGenerationModel } from './system-config'
import { getDevicePreset } from './device-presets'
import type { ModelConfig, SceneConfig } from './types'

// 下载 AI 返回的图片 URL 时使用的 dispatcher：
// - 连接超时拉长到 30s（Node 原生 fetch 默认 10s 对国内 CDN 不够）
// - 支持 HTTPS_PROXY / HTTP_PROXY 环境变量
const imageDownloadDispatcher = (() => {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy
  if (proxyUrl) {
    try {
      return new ProxyAgent({ uri: proxyUrl, connectTimeout: 30_000, headersTimeout: 60_000, bodyTimeout: 120_000 })
    } catch (err) {
      console.warn('[ai-service] ProxyAgent 初始化失败，回退到默认 Agent:', err)
    }
  }
  return new Agent({ connect: { timeout: 30_000 }, headersTimeout: 60_000, bodyTimeout: 120_000 })
})()
import {
  appendPoseAndExpression,
  buildModelCorePhysical,
  getEthnicityLabel,
  getModelBodyTypePhrase,
  getModelCategoryStyleParagraph,
  getModelGenderDescriptor,
  getModelSkinTonePhrase,
} from './model-narrative'

type ChatMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } }

type ChatCompletionResponse = {
  error?: { message?: string }
  choices?: Array<{
    message?: {
      content?: unknown
      images?: Array<{
        b64_json?: string
        url?: string
        mime_type?: string
        media_type?: string
      }>
    }
  }>
  data?: Array<{
    b64_json?: string
    url?: string
    mime_type?: string
    media_type?: string
  }>
}

type ImagePayload = {
  base64: string
  mimeType: string
}

const mimeByExtension: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

const extensionByMime: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
}

const toStoredFilePath = (relativePath: string) => `/${relativePath}`

export class AIService {
  private getUniversalAntiFakeFaceClause(): string {
    return 'UNIVERSAL FACE REALISM CONSTRAINT (ALL MODES): if any human face/skin appears, keep natural pores, slight tonal unevenness, faint peach-fuzz, subtle under-eye and smile-line texture, and mild asymmetry; strictly forbid beauty-filter smoothing, pore erasing, skin whitening pass, wrinkle suppression, wax/plastic skin, porcelain look, doll-like glassy eyes, and over-retouched complexion.'
  }

  // 1. 服装分析 - 完整保留
  async analyzeClothing(clothingUrl: string, clothingLength?: string, clothingBackUrl?: string, clothingDetailUrls?: string[], userApiKey?: string): Promise<string> {
    const clothingLengthMap: Record<string, string> = {
      cropped: 'cropped length (above waist)',
      standard: 'standard length (at waist)',
      'hip-length': 'hip-length (covers the hips)',
      'knee-length': 'knee-length (reaches the knees)',
      'ankle-length': 'ankle-length (reaches the ankles)',
    }
    const lengthHint = clothingLength && clothingLengthMap[clothingLength]
      ? ` The garment length is ${clothingLengthMap[clothingLength]}.`
      : ''

    // 收集所有图片 URL
    const allUrls = [clothingUrl]
    if (clothingBackUrl) allUrls.push(clothingBackUrl)
    if (clothingDetailUrls?.length) allUrls.push(...clothingDetailUrls.filter(Boolean))

    // 只有一张图时使用简单分析
    if (allUrls.length === 1) {
      return this.analyzeImage(
        clothingUrl,
        `You are a senior fashion stylist. Describe only the garment in concise English for downstream image generation. Focus on category, color, fabric, silhouette, patterns, trims, logos and styling details.${lengthHint} Ignore the background, model and camera info. Return one sentence only.`,
        userApiKey
      )
    }

    // 多图时使用多图分析
    const imageContents: ChatMessageContentPart[] = []
    for (const imgUrl of allUrls) {
      imageContents.push({
        type: 'image_url' as const,
        image_url: { url: await this.toDataUrl(imgUrl), detail: config.aiImageDetail },
      })
    }

    const textPart: ChatMessageContentPart = {
      type: 'text',
      text: `You are a senior fashion stylist. I'm providing multiple images of the same garment: the first image is the front view${clothingBackUrl ? ', the second is the back view' : ''}${clothingDetailUrls?.length ? `, and the remaining are detail close-ups` : ''}. Describe the COMPLETE garment in concise English for downstream image generation. Combine information from ALL images to give the most thorough description. IMPORTANT: If detail close-up images are provided, the garment COLOR must be determined from the detail images as they show the most accurate color representation. Focus on category, color (from detail images if available), fabric, silhouette, patterns, trims, logos, stitching details, buttons/zippers, back design, and styling details.${lengthHint} Ignore the background, model and camera info. Return one sentence only.`,
    }

    const response = await this.requestChatCompletion({
      model: getActiveAnalysisModel(),
      stream: false,
      messages: [
        { role: 'system', content: 'You are a senior fashion stylist. Analyze garment images and provide concise descriptions.' },
        { role: 'user', content: [textPart, ...imageContents] },
      ],
    }, userApiKey)

    const content = response.choices?.[0]?.message?.content
    return typeof content === 'string' ? content.trim() : ''
  }

  // 2. 模特描述 - 完整保留
  async describeModel(_clothingUrl: string, modelConfig: ModelConfig, sceneMode?: string, userApiKey?: string): Promise<string> {
    const isReplaceMode = sceneMode === 'replace'

    const categoryStyle = getModelCategoryStyleParagraph(modelConfig.category)
    const corePhysical = buildModelCorePhysical(modelConfig)
    const poseExpr = appendPoseAndExpression(modelConfig)

    // 替换模式下只描述模特面部和体型，姿势由参考图决定
    if (isReplaceMode) {
      if (modelConfig.mode === 'upload' && modelConfig.imageUrl) {
        const facialDescription = await this.analyzeImage(
          modelConfig.imageUrl,
          'Describe ONLY the facial features (face shape, eyes, nose, mouth), hair style and color, skin tone, and body type. DO NOT describe pose, gesture, expression, or lighting. Return one sentence only.',
          userApiKey
        )
        return `Casting direction: ${categoryStyle} Subject details: ${corePhysical} Face and hair from reference: ${facialDescription.trim()}`
      }
      return `Casting direction: ${categoryStyle} Subject details: ${corePhysical}`.trim()
    }

    if (modelConfig.mode === 'upload' && modelConfig.imageUrl) {
      const facialDescription = await this.analyzeImage(
        modelConfig.imageUrl,
        'Describe ONLY the facial features (face shape, eyes, nose, mouth), hair style and color, skin tone, and body type. DO NOT describe pose, gesture, expression, or lighting. Return one sentence only.',
        userApiKey
      )
      return `Casting direction: ${categoryStyle} Subject details: ${corePhysical} Face and hair from reference: ${facialDescription.trim()}${poseExpr}`.trim()
    }

    return `Casting direction: ${categoryStyle} Subject details: ${corePhysical}${poseExpr}`.trim()
  }

  // 3. 场景描述
  async describeScene(sceneConfig: SceneConfig, userApiKey?: string): Promise<string> {
    // 补充提示词（两种模式通用）
    const extraPrompt = sceneConfig.prompt ? `, ${sceneConfig.prompt}` : ''

    if (sceneConfig.mode === 'replace' && sceneConfig.imageUrl) {
      const desc = await this.analyzeImage(
        sceneConfig.imageUrl,
        'Describe ONLY the background scene in concise English. Include: location type, architecture, setting, atmosphere, and lighting conditions. Then describe the body pose/posture (standing position, arm positions, leg stance) as a pose blueprint. CRITICAL: Do NOT describe the person\'s face, hair, skin tone, or clothing — these will be replaced. Return two sentences only.',
        userApiKey
      )
      return desc + extraPrompt
    }

    // 预设场景模式：上传场景图
    if (sceneConfig.sceneSource === 'upload' && sceneConfig.imageUrl) {
      const desc = await this.analyzeImage(
        sceneConfig.imageUrl,
        'Describe the background scene AND lighting conditions in detail for photorealistic fashion photography. You MUST include: (1) location type and architecture; (2) PRIMARY LIGHT SOURCE direction (e.g., light from upper left, backlit, overhead, window light from right); (3) light color temperature (warm golden/cool blue/neutral white); (4) shadow characteristics (soft diffused/hard edged, direction and length); (5) ambient light reflections and bounce light from surrounding surfaces (color spills from walls, floor, sky); (6) atmosphere and color palette; (7) BEST PLACEMENT ZONE — identify 1-2 natural positions where a person could realistically stand or pose in this scene (e.g., center of walkway, beside the window, on the steps, near the column). Describe the spatial layout: what is foreground, where open space exists, what surfaces a person could stand on. This placement and lighting information is CRITICAL for placing a person into this scene with photorealistic light coherence and spatial logic. Ignore any foreground people. Return 2-4 sentences.',
        userApiKey
      )
      return desc + extraPrompt
    }

    // 预设场景模式：场景预设
    const parts: string[] = [sceneConfig.preset]
    if (sceneConfig.timeOfDay) parts.push(sceneConfig.timeOfDay)
    if (sceneConfig.lighting) parts.push(sceneConfig.lighting)
    if (sceneConfig.composition) parts.push(sceneConfig.composition)
    if (sceneConfig.prompt) parts.push(sceneConfig.prompt)

    return parts.join(', ')
  }

  // 构建街拍 prompt - 完整保留
  buildStreetFashionPrompt(
    _clothingDescription: string,
    modelDescription: string,
    sceneDescription: string,
    _modelConfig: ModelConfig,
    sceneConfig: SceneConfig
  ): string {
    const accessoryGeneral =
      'STYLING LOCK — ACCESSORIES: Do not invent handbags, purses, totes, backpacks, jewelry, watches, sunglasses, hats, belts, scarves, or gloves unless they are clearly visible in the CLOTHING reference images. Hands, wrists, neck, and ears should have no added bling unless shown in references. If the frame omits lower body, imply plain neutral bottoms and minimal or off-frame footwear — no logos, no statement shoes, no props.'

    const accessoryBatch = sceneConfig.batchVariation
      ? ' BATCH CONSISTENCY LOCK (CRITICAL — each image in this batch is generated independently, so you MUST follow these FIXED decisions exactly): ZERO handbags/purses/totes/clutches — hands are empty. ZERO jewelry (no necklaces, earrings, rings, bracelets, watches). ZERO sunglasses. ZERO hats/headwear. ZERO belts unless the referenced garment itself has one. ZERO scarves/gloves. Footwear: plain minimal neutral shoes (simple white sneakers or nude flats) if feet are visible, otherwise off-frame. Bottoms: plain dark neutral trousers/jeans if lower body is visible and the referenced garment does not cover it. These decisions are ABSOLUTE and IDENTICAL for every image in this batch — only pose and/or scene change.'
      : ''

    const isReplaceMode = sceneConfig.mode === 'replace'
    // 前端「不指定」时 omits / undefined：用与街拍一致的稳妥默认，避免误走浅景深分支
    const depthOfField = sceneConfig.depthOfField ?? 'slight'
    const aspectRatio = sceneConfig.aspectRatio ?? '3:4'
    const grain = sceneConfig.grain ?? 'none'
    const exposureMode = sceneConfig.exposureMode ?? 'natural'

    // 噪点描述
    const grainDesc = grain === 'heavy'
      ? 'heavy film grain texture, prominent visible noise, analog film aesthetic, ISO 3200 look, gritty organic grain throughout'
      : grain === 'light'
      ? 'subtle film grain, light natural noise texture, ISO 800 look, fine organic grain, analog warmth'
      : ''

    if (isReplaceMode) {
      const grainPart = grainDesc ? `, ${grainDesc}` : ''
      const exposureGuidance = exposureMode === 'bright'
        ? 'Exposure mode: BRIGHT — keep overall image slightly brighter (+0.3 EV feel), lift shadows moderately, but do NOT clip skin or garment highlights.'
        : exposureMode === 'dark'
        ? 'Exposure mode: DARK — keep overall image slightly darker (-0.5 EV feel), prioritize highlight protection, preserve shadow detail without crushing blacks.'
        : 'Exposure mode: NATURAL — balanced exposure around neutral/slightly conservative, protect highlights and maintain realistic mid-tone contrast.'
      return [
        'TASK: Generate a photorealistic fashion image by placing a NEW model into the scene.',
        'IMAGE ROLES (in order):',
        '  [1] MODEL FACE REFERENCE — Use THIS person\'s face, hair color/style, skin tone, and facial features ONLY.',
        '  [2] CLOTHING REFERENCE — The NEW model must wear EXACTLY this garment, preserving all details, color, fabric, texture.',
        '  [3] SCENE/POSE REFERENCE — Copy ONLY: (a) the background/environment, (b) the body pose/posture/gesture. IGNORE the person in this image completely — their face, hair, and body should NOT appear in the output.',
        '',
        `New model description: ${modelDescription}.`,
        'CRITICAL FACE RULE: The generated model\'s face MUST be identical to [1] — same face shape, eyes, nose, mouth, hair, skin tone. Copy the face from [1] exactly, do not invent or blend.',
        'CRITICAL CLOTHING RULE: The garment MUST be identical to [2] — same design, color, fabric texture, patterns, fit.',
        accessoryGeneral + accessoryBatch,
        'CRITICAL POSE RULE: The body position MUST match [3] — same posture, gesture, angle, stance.',
        'CRITICAL PLACEMENT RULE: Place the model at a SCENE-APPROPRIATE position. Analyze the scene\'s spatial layout — the model must stand on a walkable surface (floor, path, steps, ground), NOT floating, NOT embedded in walls, NOT on unstable surfaces. Feet must rest on a logical ground plane consistent with the scene.',
        'CRITICAL DELETION: Completely remove the original person from [3]. Keep only background + pose blueprint.',
        `Maintain natural skin texture (pores, no wax), realistic textile folds, accurate garment details, real-camera street-snap quality${grainPart ? `, ${grainPart}` : ''}. ${exposureGuidance} Avoid CGI polish and beauty-filter faces.`,
        'Return only the final image as base64 data without markdown.',
      ].join('\n')
    }

    const isUploadScene = sceneConfig.sceneSource === 'upload'

    let depthEffect: string
    let avoidTerms: string

    const antiFake =
      'Avoid: CGI, 3D render, game-engine look, plastic or wax skin, airbrushed beauty-filter face, uncanny perfect symmetry, ' +
      'over-smoothed skin, poreless forehead, poreless cheeks, no under-eye texture, no nasolabial texture, over-whitened teeth, glassy doll eyes, ' +
      'oversaturated HDR glow, neon rim lights, fake studio lighting on a street scene, synthetic fabric sheen, painterly or illustration style, ' +
      'extra limbs, warped hands, duplicated accessories, text overlays, heavy AI oversharpening, porcelain doll complexion.'

    if (depthOfField === 'deep') {
      depthEffect = 'deep depth of field, sharp focus throughout the entire image, background fully in focus with crisp details, no background blur, clear background details, f/16 aperture effect'
      avoidTerms = `${antiFake} Also avoid: artificial background blur, bokeh when the scene calls for deep focus.`
    } else if (depthOfField === 'slight') {
      depthEffect = 'slight depth of field, gentle natural background blur, soft bokeh, f/4 aperture effect'
      avoidTerms = `${antiFake} Also avoid: cartoonish bokeh circles, tilt-shift toy effect.`
    } else {
      depthEffect = 'shallow depth of field, bokeh background, soft background blur'
      avoidTerms = antiFake
    }

    let aspectGuidance = ''
    if (aspectRatio === '1:1') aspectGuidance = 'square format composition, centered subject'
    else if (aspectRatio === '3:4') aspectGuidance = 'portrait orientation, vertical composition, 3:4 aspect ratio'
    else if (aspectRatio === '4:3') aspectGuidance = 'landscape orientation, horizontal composition, 4:3 aspect ratio'
    else if (aspectRatio === '9:16') aspectGuidance = 'vertical portrait orientation, tall composition, 9:16 aspect ratio, mobile screen format'
    else if (aspectRatio === '16:9') aspectGuidance = 'wide landscape orientation, cinematic widescreen composition, 16:9 aspect ratio'

    const grainPart = grainDesc ? `, ${grainDesc}` : ''

    const exposureGuidance = exposureMode === 'bright'
      ? 'Exposure mode: BRIGHT — keep overall image slightly brighter (+0.3 EV feel), lift shadows moderately, but do NOT clip skin or garment highlights.'
      : exposureMode === 'dark'
      ? 'Exposure mode: DARK — keep overall image slightly darker (-0.5 EV feel), prioritize highlight protection, preserve shadow detail without crushing blacks.'
      : 'Exposure mode: NATURAL — balanced exposure around neutral/slightly conservative, protect highlights and maintain realistic mid-tone contrast.'

    const lightingIntegration = isUploadScene
      ? `UNIFIED GLOBAL ILLUMINATION: The person and scene MUST share the EXACT SAME lighting system. Light direction, color temperature, shadow angle and ambient reflections on the person MUST perfectly match the scene environment. Apply scene light source to person: matching highlight positions on skin and hair, consistent diffuse reflection on clothing fabric, correct subsurface scattering on skin (warm translucency in backlit/rim light, cool shadow tones in overcast), and proper ambient occlusion where body contacts ground or nearby surfaces. Person must cast shadows consistent with scene light direction. NO separate lighting on the person — they exist within the scene light, not in front of it. Exposure control: preserve highlight detail on forehead/cheekbones/fabric, avoid clipped whites and bloom, keep brightness natural (slightly under by ~0.3 EV if uncertain). Shot on Sony A7IV with 85mm f/1.4 lens${grainPart}, organic skin texture with visible pores, soft natural highlights, realistic color rendition, DSLR raw photo quality`
      : `REAL-WORLD AMBIENT LIGHT ONLY: natural uncontrolled outdoor or urban mixed light (sky + building bounce + occasional hard sun patches), NOT cinematic key/fill/rim, NOT beauty-dish studio. Slight exposure imperfection is OK. Color: restrained SOOC look — muted mids, natural white balance drift, no teal-orange blockbuster grade, no glowing skin. Exposure control: prioritize highlight retention, avoid overexposed faces/garments, avoid blown-out sky and hotspot bloom, keep overall brightness slightly conservative. As if handheld snapshot on full-frame mirrorless (e.g. Sony A7 / Canon R) with 35mm or 50mm lens at moderate ISO${grainPart ? `, ${grainPart}` : ', faint sensor noise acceptable'}.`

    const realismBlock =
      'Photoreal mandate: must look like an unposed or lightly directed real street snap someone posted online — believable weight, gravity on cloth, micro shadow acne/texture, faint under-eye tone, slight asymmetry between left/right face, subtle nasolabial and eyelid texture, tiny skin irregularities (pores, peach-fuzz, faint blemish marks), stray hairs, fabric lint where natural. Exposure discipline: protect highlights, avoid clipped whites on skin/garment, keep realistic mid-tone contrast, no blown-out sky, no overexposure glow, target slightly conservative exposure (around -0.3 EV look). NOT a glossy magazine CGI hero shot. NOT porcelain doll skin.'

    return [
      'Generate ONE image that is indistinguishable from a real photograph (not illustration, not 3D, not AI-art).',
      realismBlock,
      `Keep the garment faithful to the clothing reference image — reproduce it exactly as shown, preserving all details, color, fabric texture, patterns, and structural elements.`,
      accessoryGeneral + accessoryBatch,
      `Model requirement: ${modelDescription}.`,
      `Scene requirement: ${sceneDescription}.`,
      `Style: authentic street fashion documentation — realistic textile folds, accurate garment details, balanced anatomy, visible skin pores and subtle asymmetry, ${lightingIntegration}, ${depthEffect}${aspectGuidance ? `, ${aspectGuidance}` : ''}. ${exposureGuidance}`,
      avoidTerms,
      'Return only the final image as base64 data without markdown.',
    ].join(' ')
  }

  // 4. 生成结果图 - 完整保留
  async generateResultImage(
    taskId: string,
    prompt: string,
    references: {
      clothingUrl: string
      clothingBackUrl?: string
      clothingDetailUrls?: string[]
      modelConfig: ModelConfig
      sceneConfig: SceneConfig
    },
    userApiKey?: string
  ): Promise<string> {
    const universalAntiFakeFace = this.getUniversalAntiFakeFaceClause()
    const imageUserPrompt = `${prompt}\n\n${universalAntiFakeFace}`
    const content: ChatMessageContentPart[] = [{ type: 'text', text: imageUserPrompt }]

    // 替换模式：模特参考图(新人物锚点) → 服装图 → 场景参考图(姿势+背景)
    // 模特图放最前面，AI 优先用这张脸而非原图的脸
    // 普通模式：服装图 → 模特参考图 → 场景参考图
    if (references.sceneConfig.mode === 'replace') {
      let modelFaceImageUrl: string | null = null

      // 1. 模特参考图（新人物面部锚点，最优先）
      if (references.modelConfig.mode === 'upload' && references.modelConfig.imageUrl) {
        modelFaceImageUrl = references.modelConfig.imageUrl
      } else {
        // 没有模特参考图时，先用文字描述生成一张面部肖像作为锚点
        // 这样 AI 就有明确的面部参考，不会使用场景图中的脸
        modelFaceImageUrl = await this.generateFacePortrait(taskId, prompt, references.modelConfig, userApiKey)
      }

      if (modelFaceImageUrl) {
        content.push({
          type: 'image_url',
          image_url: {
            url: await this.toDataUrl(modelFaceImageUrl),
            detail: config.aiImageDetail,
          },
        })
      }

      // 2. 服装图（正面）
      content.push({
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(references.clothingUrl),
          detail: config.aiImageDetail,
        },
      })

      // 2.5 服装背面图
      if (references.clothingBackUrl) {
        content.push({
          type: 'image_url',
          image_url: {
            url: await this.toDataUrl(references.clothingBackUrl),
            detail: config.aiImageDetail,
          },
        })
      }

      // 2.6 服装细节图
      if (references.clothingDetailUrls?.length) {
        for (const url of references.clothingDetailUrls.filter(Boolean)) {
          content.push({
            type: 'image_url',
            image_url: {
              url: await this.toDataUrl(url),
              detail: config.aiImageDetail,
            },
          })
        }
      }

      // 3. 场景参考图（提供姿势和背景，必须删除原图人物）
      if (references.sceneConfig.imageUrl) {
        content.push({
          type: 'image_url',
          image_url: {
            url: await this.toDataUrl(references.sceneConfig.imageUrl),
            detail: config.aiImageDetail,
          },
        })
      }
    } else {
      // 预设场景模式
      const isUploadScene = references.sceneConfig.sceneSource === 'upload'

      // 上传场景图时：模特参考图放最前面，避免被场景图淹没
      if (isUploadScene && references.modelConfig.mode === 'upload' && references.modelConfig.imageUrl) {
        content.push({
          type: 'image_url',
          image_url: {
            url: await this.toDataUrl(references.modelConfig.imageUrl),
            detail: config.aiImageDetail,
          },
        })
      }

      // 服装图（正面）
      content.push({
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(references.clothingUrl),
          detail: config.aiImageDetail,
        },
      })

      // 服装背面图
      if (references.clothingBackUrl) {
        content.push({
          type: 'image_url',
          image_url: {
            url: await this.toDataUrl(references.clothingBackUrl),
            detail: config.aiImageDetail,
          },
        })
      }

      // 服装细节图
      if (references.clothingDetailUrls?.length) {
        for (const url of references.clothingDetailUrls.filter(Boolean)) {
          content.push({
            type: 'image_url',
            image_url: {
              url: await this.toDataUrl(url),
              detail: config.aiImageDetail,
            },
          })
        }
      }

      // 模特参考图（场景预设模式下放在服装图后面）
      if (!isUploadScene && references.modelConfig.mode === 'upload' && references.modelConfig.imageUrl) {
        content.push({
          type: 'image_url',
          image_url: {
            url: await this.toDataUrl(references.modelConfig.imageUrl),
            detail: config.aiImageDetail,
          },
        })
      }

      // 场景参考图
      if (isUploadScene && references.sceneConfig.imageUrl) {
        content.push({
          type: 'image_url',
          image_url: {
            url: await this.toDataUrl(references.sceneConfig.imageUrl),
            detail: config.aiImageDetail,
          },
        })
      }
    }

    // 根据场景模式选择 system prompt
    let systemPrompt: string
    if (references.sceneConfig.mode === 'replace') {
      systemPrompt = `You are an expert fashion image compositing model. Your task is to create a new image by combining elements from multiple reference images.

IMAGE REFERENCE MAP (process in this exact order):
- Image 1: MODEL FACE REFERENCE — Extract and use ONLY the facial features, hair style/color, and skin tone. This is the FACE IDENTITY for the new model.
- Image 2+: CLOTHING REFERENCE — The garment the new model must wear. Preserve every detail: color, fabric, texture, pattern, fit.
- Last Image: SCENE/POSE REFERENCE — Extract ONLY: (a) the background setting and lighting, (b) the body pose, posture, and gesture. COMPLETELY IGNORE the person in this image.

CORE DIRECTIVE:
You are performing a "face swap with pose preservation". The person in the scene reference must be ENTIRELY REPLACED.

STRICT RULES:
1. FACE: The output model's face MUST match Image 1 exactly. Copy the face shape, eye shape, nose, mouth, hair, skin tone from Image 1. Do NOT use the face from the scene reference.
2. CLOTHING: The output model MUST wear the exact garment from the clothing reference(s). Preserve all details.
3. POSE: The output model's body position MUST match the pose in the scene reference.
4. PLACEMENT: The model MUST stand at a scene-appropriate position — on a walkable surface (floor, path, ground, steps), with feet resting naturally. Do NOT place the model floating, embedded in walls, or on illogical surfaces.
5. BACKGROUND: Preserve the exact background, lighting, and atmosphere from the scene reference.
6. DELETION: The original person in the scene reference is GONE. Do not blend their features.

LIGHTING COHERENCE: The new model must be lit by the scene's lighting — matching highlight positions, shadow angles, color temperature, and ambient reflections.

PHOTOREAL OUTPUT: Final image must look like a real composite photo — not 3D, not plastic skin, not oversharpened. Preserve subtle skin texture and natural imperfections.

Return only the generated image in base64 without markdown or explanation.`
    } else if (references.sceneConfig.sceneSource === 'upload') {
      systemPrompt = 'You are an expert fashion image generation model optimized for PHOTOREAL street-style output. You may receive up to 3 images: (1) MODEL FACE reference (if provided) — you MUST use this person\'s face, hair and skin tone for the generated model. (2) CLOTHING reference — the garment the model must wear. (3) SCENE reference — use ONLY the background and atmosphere from this image. SCENE-APPROPRIATE PLACEMENT (CRITICAL): You MUST analyze the scene\'s spatial layout and place the person at the most natural, logical position in that environment. Examples: if the scene has a walkway/path, place the person ON the walkway; if it has steps, the person can stand on the steps; if it has a window, the person can lean beside it. NEVER place the person in an illogical position (e.g., floating in mid-air, embedded in a wall, standing on an unstable surface, or in a place where no real person could stand). The person\'s feet MUST rest on a walkable surface consistent with the scene\'s ground plane. CRITICAL LIGHTING RULES: (1) Analyze the scene reference lighting — light source direction, color temperature, shadow direction, ambient bounce light color. (2) The generated person MUST be lit by the EXACT SAME lighting as the scene: matching highlight positions on skin and hair, consistent diffuse reflection on clothing, correct subsurface scattering on skin (warm translucency in backlit, cool shadows in overcast), ambient occlusion at ground contact, and shadows cast by the person must match scene light direction. (3) NO separate or additional lighting on the person. They exist within the scene light, not in front of it. (4) If a model face image is provided, the generated person\'s face MUST match it, NOT any person in the scene reference. The scene reference provides background and lighting ONLY, ignore any people in it. OUTPUT MUST look like a real photograph: visible skin texture and pores, fine peach-fuzz, tiny tonal unevenness, natural under-eye and smile-line texture, slight facial asymmetry; no plastic/wax skin, no beauty-app smoothing, no pore erasing, no HDR glow, no illustration or 3D render look. Return only the generated image in base64 without markdown or explanation.'
    } else {
      systemPrompt = 'You are an expert fashion photographer\'s image generator: output must be indistinguishable from a real camera photo of street fashion. When a model reference image is provided, extract ONLY facial features, hair, and skin tone. The pose, expression, lighting, and aspect ratio MUST come from the text prompt, not from the reference images. IMPORTANT: Ignore the dimensions and aspect ratio of all reference images. Generate the output image with the exact aspect ratio specified in the prompt. CRITICAL REALISM: natural ambient light only (no fake studio rim), visible skin pores and micro-imperfections, soft peach-fuzz, subtle under-eye and nasolabial texture, slight face asymmetry, muted natural color grading, subtle sensor noise OK — reject plastic skin, airbrushed faces, poreless beauty-filter finish, CGI sheen, oversharpening, and illustration style. Return only the generated image in base64 without markdown or explanation.'
    }

    if (references.sceneConfig.batchVariation) {
      systemPrompt +=
        ' BATCH SERIES (CRITICAL): This image is ONE of multiple independent renders using the same garment. Because each render is independent, you MUST follow these FIXED styling rules exactly to guarantee visual consistency across all images: (1) ZERO accessories — no handbags, purses, clutches, jewelry, watches, necklaces, earrings, rings, bracelets, sunglasses, hats, headwear, belts (unless on the garment itself), scarves, or gloves. Hands must be EMPTY. (2) If lower body is visible and the garment does not cover it, use ONLY plain dark neutral trousers or jeans. (3) If feet are visible, use ONLY plain minimal shoes (simple white sneakers or nude flats). (4) ONLY vary pose and/or scene as the user text states — everything else about the outfit must be identical across renders.'
    }

    const genPayload: Record<string, unknown> = {
      model: getActiveGenerationModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content,
        },
      ],
    }
    if (config.aiGenerationTemperature !== undefined) {
      genPayload.temperature = config.aiGenerationTemperature
    }

    const response = await this.requestChatCompletion(genPayload, userApiKey)

    const image = await this.extractImagePayload(response)
    const extension = extensionByMime[image.mimeType] || '.png'
    const fileName = `${taskId}${extension}`
    const filePath = path.join(getUploadPath(), 'results', fileName)

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
    return toStoredFilePath(`uploads/results/${fileName}`)
  }

  // ===== 快速工作台 =====
  /**
   * 快速工作台一键合成：衣服（正+可选反面）+ 模特参考图 + 场景图 → 最终图。
   *
   * 注：早期版本会先用一次 AI 请求（analyzeBackgroundForPlacement / analyzePersonInScene）
   * 产出"布局蓝图"再注入；简化 image2 风格的 prompt 后不再需要，直接一步出图以节省延迟与成本。
   */
  async generateQuickWorkspaceImage(
    taskId: string,
    input: {
      mode: 'background' | 'fusion'
      clothingUrl: string
      clothingBackUrl?: string
      /** 融合模式下可选：不传则保留场景图中的原模特，仅换衣服 */
      modelImageUrl?: string
      sceneImageUrl: string
      extraPrompt?: string
      aspectRatio?: '3:4' | '1:1' | '4:3' | '16:9' | '9:16'
      framing?: 'auto' | 'half' | 'full'
      device?: string
      /** 套图批量变体，启用后注入一致性锁定 */
      batchVariation?: 'pose' | 'scene' | 'both'
    },
    userApiKey?: string
  ): Promise<string> {
    const { mode, clothingUrl, clothingBackUrl, modelImageUrl, sceneImageUrl, extraPrompt, batchVariation } = input
    const aspectRatio = input.aspectRatio || '3:4'
    const framing = input.framing || 'auto'
    const devicePreset = getDevicePreset(input.device)
    const deviceBlock = devicePreset.promptFragment
      ? [
          `【拍摄模式：${devicePreset.label}（严格遵守，决定最终照片的真实质感）】`,
          devicePreset.promptFragment,
          '按以上摄影关键词还原焦距、光圈、景深、光线氛围、颗粒感与构图节奏；禁止输出计算摄影式的过度清洁/锐化/HDR。',
        ].join('\n')
      : ''

    const aspectHintMap: Record<string, string> = {
      '3:4': '输出图像比例必须为 3:4（竖向人像比例）',
      '1:1': '输出图像比例必须为 1:1（正方形）',
      '4:3': '输出图像比例必须为 4:3（横向）',
      '16:9': '输出图像比例必须为 16:9（宽屏横向）',
      '9:16': '输出图像比例必须为 9:16（手机竖屏）',
    }
    const aspectHint = aspectHintMap[aspectRatio] || '输出图像比例 3:4'

    const framingHintZh = framing === 'full'
      ? '构图：全身照，模特从头到脚完整入画。'
      : framing === 'half'
      ? '构图：半身照，腰部或胸部以上入画。'
      : '构图：根据场景氛围自动选择最合适的取景。'

    const universalAntiFakeFace = this.getUniversalAntiFakeFaceClause()

    // 角色标签法：不再用图[1]图[2]数字索引，改用固定角色名，不受图片数量影响
    const clothingRef = clothingBackUrl ? '【衣服正面】和【衣服反面】' : '【衣服正面】'

    // 套图批量一致性锁定：确保同一批生成的多张图之间穿搭一致，只变姿势/场景
    const batchLockBlock = batchVariation
      ? [
          '',
          '【套图一致性锁定 — 本图属于一组多张套图之一，必须严格遵守以下规则】',
          '- 零配饰：不得添加手提包/斜挎包/珠宝/手表/墨镜/帽子/围巾/手套，双手空空。',
          '- 下装：如果衣服未覆盖下半身，只穿简约深色中性裤装或牛仔裤。',
          '- 鞋子：如果脚部可见，只穿简约中性鞋（白色运动鞋或裸色平底鞋），否则不出镜。',
          batchVariation === 'pose' || batchVariation === 'both'
            ? '- 姿势：按提示词中指定的姿势生成，与本组其他图的姿势不同。'
            : '',
          batchVariation === 'scene' || batchVariation === 'both'
            ? '- 场景：按提示词中的场景描述生成，与本组其他图的场景不同。'
            : '',
          '- 服装、模特面部、发型、肤色必须与本组其他图完全一致。',
        ].filter(Boolean).join('\n')
      : ''

    const userPrompt = mode === 'background'
      ? [
          `让【模特】穿上${clothingRef}的衣服，放入【场景】中。真实，自然，和谐。`,
          '',
          '- 衣服颜色、面料、纹理、图案、版型必须和【衣服正面】' + (clothingBackUrl ? '以及【衣服反面】' : '') + '完全一致；除非衣服原图自带，不得新增任何配饰。',
          '- 模特脸型、五官、发色、肤色保持和【模特】一致。',
          '- 分析【场景】的空间布局，将模特放在最自然、最合理的位置（如走道中央、窗边、建筑入口、楼梯上、柱子旁等）。不得放在不合逻辑的位置（如墙面正中间、半空中、障碍物上、无立足之处）。',
          '- 画面明显是【场景】的同一地点（保留至少 2 个可辨识元素），允许重新取景和微调相机角度。',
          '- 模特的双脚必须踩在场景中可站立的表面上，身体重心自然，与场景透视和地平线一致。',
          '- 如果衣服只是上衣，必须补全协调的下装与鞋子，不得赤裸或赤脚。',
          '- 按真实成人比例渲染（约 7.5 头身），双脚踏实地面，禁止巨人感、娃娃头、悬空。',
          `- 输出比例：${aspectHint}，不要输出其他比例、不要加黑边或拉伸。`,
          `- ${framingHintZh}`,
          deviceBlock,
          extraPrompt ? `- 用户补充：${extraPrompt}` : '',
          batchLockBlock,
          '',
          '直接返回最终图片（base64，无需 markdown 或解释）。',
        ].filter(Boolean).join('\n')
      : modelImageUrl
      ? [
          // 融合模式 + 有模特图：用模特的脸替换参考图中人物的脸
          `让【模特】穿上${clothingRef}的衣服，替换【参考图】中的人物。`,
          '',
          '- 【模特】的脸必须完全替换掉【参考图】中原人物的脸，禁止保留参考图的任何面部特征',
          '- 衣服必须和【衣服正面】' + (clothingBackUrl ? '以及【衣服反面】' : '') + '完全一致',
          '- 保留【参考图】的姿态和场景，删除原人物',
          '- 背景可做微调（光影方向/色温可变，摆件可换，整体氛围保持）',
          batchVariation
            ? '- 下装：简约深色中性裤装，不得添加任何配饰（套图模式）'
            : '- 下装：如果参考图人物穿着下装，新人物的下装款式和颜色可做轻微调整（换不同版型/颜色/长度），不要和参考图一模一样',
          batchVariation
            ? '- 配饰：零配饰，双手空空（套图模式）'
            : '- 配饰：换不同款式，但类型对应（有包→有包，有帽→有帽）',
          '- 真实成人比例（7.5头身），双脚着地',
          `- 输出比例：${aspectHint}`,
          `- ${framingHintZh}`,
          deviceBlock,
          extraPrompt ? `- 用户补充：${extraPrompt}` : '',
          batchLockBlock,
          '',
          universalAntiFakeFace,
          '',
          '直接返回最终图片（base64，无需 markdown 或解释）。',
        ].filter(Boolean).join('\n')
      : [
          // 融合模式 + 无模特图：保留参考图中原模特的脸和姿势，只换衣服
          `让【参考图】中原人物穿上${clothingRef}的衣服。保留原人物的脸、姿势和场景，只替换衣服。`,
          '',
          '- 保留【参考图】中原人物的面部、发型、肤色、体型，不得改变原人物的任何面部特征',
          '- 衣服必须和【衣服正面】' + (clothingBackUrl ? '以及【衣服反面】' : '') + '完全一致，精确还原颜色、面料、纹理、图案、版型',
          '- 保持【参考图】中人物的姿势和站位不变，只替换穿在身上的衣服',
          '- 保持【参考图】的场景和背景不变',
          batchVariation
            ? '- 下装：如果衣服只是上衣，穿简约深色中性裤装，不得添加任何配饰（套图模式）'
            : '- 下装：如果参考图人物穿着下装，新衣服未覆盖下半身时，保持原下装或做轻微调整',
          batchVariation
            ? '- 配饰：零配饰，双手空空（套图模式）'
            : '- 配饰：保持原参考图中的配饰',
          '- 真实成人比例（7.5头身），双脚着地',
          `- 输出比例：${aspectHint}`,
          `- ${framingHintZh}`,
          deviceBlock,
          extraPrompt ? `- 用户补充：${extraPrompt}` : '',
          batchLockBlock,
          '',
          universalAntiFakeFace,
          '',
          '直接返回最终图片（base64，无需 markdown 或解释）。',
        ].filter(Boolean).join('\n')

    const content: ChatMessageContentPart[] = []

    // 统一结构：先放角色标签+图片，让AI先看图，最后放文字指令
    // 融合模式无模特图时，跳过模特图片部分
    if (modelImageUrl) {
      content.push({ type: 'text', text: '【模特】' })
      content.push({
        type: 'image_url',
        image_url: { url: await this.toDataUrl(modelImageUrl), detail: config.aiImageDetail },
      })
    }
    content.push({ type: 'text', text: '【衣服正面】' })
    content.push({
      type: 'image_url',
      image_url: { url: await this.toDataUrl(clothingUrl), detail: config.aiImageDetail },
    })
    if (clothingBackUrl) {
      content.push({ type: 'text', text: '【衣服反面】' })
      content.push({
        type: 'image_url',
        image_url: { url: await this.toDataUrl(clothingBackUrl), detail: config.aiImageDetail },
      })
    }
    content.push({ type: 'text', text: mode === 'background' ? '【场景】' : '【参考图】' })
    content.push({
      type: 'image_url',
      image_url: { url: await this.toDataUrl(sceneImageUrl), detail: config.aiImageDetail },
    })
    content.push({ type: 'text', text: userPrompt })

    const systemPrompt = mode === 'background'
      ? '你是顶级时尚摄影师。规则：1.严格还原衣服的颜色、面料、纹理、图案、版型；2.模特仅保留脸部身份，禁止复制其姿势、构图、比例；3.场景保持标志性元素，人物放在最自然合理的位置；4.真实相机质感，禁止CGI/塑料感/美颜/插画感/扭曲肢体；5.直接返回base64，不要解释。'
      : modelImageUrl
      ? '你是顶级时尚摄影师。规则：1.人脸替换是最高优先级，用模特图的脸替换参考图中人物的脸；2.严格还原衣服的颜色、面料、纹理、图案、版型；3.保留参考图的姿态和场景；4.真实成人比例，双脚着地；5.真实相机质感，禁止CGI/塑料感/美颜/蜡像/扭曲肢体；6.直接返回base64，不要解释。'
      : '你是顶级时尚摄影师。规则：1.保留参考图中原人物的面部、发型、肤色、体型不变；2.严格还原衣服的颜色、面料、纹理、图案、版型；3.保持原人物的姿势和场景不变，只替换穿在身上的衣服；4.真实成人比例，双脚着地；5.真实相机质感，禁止CGI/塑料感/美颜/蜡像/扭曲肢体；6.直接返回base64，不要解释。'

    const genPayload: Record<string, unknown> = {
      model: getActiveGenerationModel(),
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
    }
    if (config.aiGenerationTemperature !== undefined) {
      genPayload.temperature = config.aiGenerationTemperature
    }

    const response = await this.requestChatCompletion(genPayload, userApiKey)

    const image = await this.extractImagePayload(response)
    const extension = extensionByMime[image.mimeType] || '.png'
    const fileName = `${taskId}${extension}`
    const filePath = path.join(getUploadPath(), 'results', fileName)

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
    return toStoredFilePath(`uploads/results/${fileName}`)
  }

  // 4.5 生成面部肖像 - 替换模式下文字描述模特时，生成半身/全身肖像作为锚点图
  private async generateFacePortrait(
    taskId: string,
    prompt: string,
    modelConfig: ModelConfig,
    userApiKey?: string
  ): Promise<string> {
    // 从 prompt 中提取模特描述（buildStreetFashionPrompt 中 "New model description:" 后面的部分）
    const modelDescMatch = prompt.match(/New model description:\s*(.+?)(?:\n|CRITICAL)/)
    const modelDesc = modelDescMatch?.[1]?.trim() || ''

    const ethnicity = getEthnicityLabel(modelConfig.ethnicity)

    // 替换模式下生成半身/全身肖像（而非只有头肩），帮助 AI 更好地与参考图姿势融合
    const genderDesc = getModelGenderDescriptor(modelConfig.gender)
    const skinDesc = getModelSkinTonePhrase(modelConfig.skinTone)
    const bodyDesc = getModelBodyTypePhrase(modelConfig.bodyType)

    const facePortraitPrompt = [
      `Generate a photorealistic half-body to full-body portrait of a ${modelConfig.age}-year-old ${ethnicity} ${genderDesc} with ${skinDesc} and ${bodyDesc}.`,
      modelDesc ? `Features: ${modelDesc}` : '',
      modelConfig.faceFeature ? `Additional features: ${modelConfig.faceFeature}` : '',
      'RELAXED NATURAL STANDING POSE — arms at sides or in natural position, body slightly angled, NOT a stiff front-facing portrait.',
      'The person is wearing a simple fitted white t-shirt and dark pants (neutral clothing that does NOT distract from face/body features).',
      'Controlled studio lighting: balanced key + gentle fill + subtle rim, SOFTLY DIFFUSED, face clearly visible while preserving highlight detail, no blown highlights, no harsh shadows.',
      'SKIN MUST LOOK NATURALLY MATTE — no specular reflections on forehead/nose/cheeks/chin, no shiny or oily or glossy appearance on the face, no wet-look sheen, no blown-out hot spots. Subtle subsurface glow is fine; hard highlights are not.',
      'Neutral light grey studio backdrop. Shot on Hasselblad X2D 90mm, natural skin texture with visible pores, soft natural highlights, realistic color rendition.',
      'IMPORTANT: This image will be used as a MODEL REFERENCE for compositing into a scene. The face must be clear and well-lit, AND the body posture should be natural and relaxed (standing, not sitting). The clothing should be simple and neutral.',
      'Return only the final image as base64.',
    ].filter(Boolean).join(' ')

    const response = await this.requestChatCompletion({
      model: getActiveGenerationModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You are an expert portrait generation model. Generate a clear, well-lit, natural standing portrait for use as a model reference. The face must be clearly visible and photorealistic, with a relaxed natural body posture (not stiff front-facing). The subject should wear simple neutral clothing. CRITICAL: the face MUST look naturally matte — no specular reflections, no shiny hot-spots, no oily or glossy skin, no wet-look sheen. Return only the generated image in base64 without markdown or explanation.',
        },
        {
          role: 'user',
          content: [{ type: 'text', text: facePortraitPrompt }],
        },
      ],
    }, userApiKey)

    const image = await this.extractImagePayload(response)
    const extension = extensionByMime[image.mimeType] || '.png'
    const fileName = `${taskId}_face_ref${extension}`
    const filePath = path.join(getUploadPath(), 'results', fileName)

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
    return toStoredFilePath(`uploads/results/${fileName}`)
  }

  // 6a. 参数生成模特 — 纯从文字参数生成全新模特半身像
  async generateModelPortrait(
    taskId: string,
    modelConfig: ModelConfig,
    userApiKey?: string,
    opts?: { count?: number; referenceUrl?: string; extraPrompt?: string }
  ): Promise<string[]> {
    const categoryStyle = getModelCategoryStyleParagraph(modelConfig.category)
    const corePhysical = buildModelCorePhysical(modelConfig)
    const poseExpr = appendPoseAndExpression(modelConfig)
    const generateCount = Math.min(Math.max(opts?.count ?? 1, 1), 4)

    const modelDescription = `Casting direction: ${categoryStyle} Subject details: ${corePhysical}${poseExpr}`.trim()

    const userExtraPrompt = (opts?.extraPrompt || '').trim()

    const prompt = [
      `Generate ${generateCount} photorealistic half-body portrait(s) (waist up) of a NEW model, 3:4 portrait aspect ratio, vertical composition.`,
      `Model specification:\n${modelDescription}`,
      opts?.referenceUrl
        ? 'A reference photo is attached. The generated model should closely match the FACE in the reference — same facial bone structure, eye shape, nose, lips, jawline, hair style/color. Adapt the body and styling as specified above.'
        : 'Create a completely unique, natural-looking person. The face should be highly detailed and photorealistic — NOT a generic stock photo face.',
      userExtraPrompt
        ? `ADDITIONAL USER INSTRUCTIONS (must be respected, but do not break realism rules below):\n${userExtraPrompt}`
        : '',
      'PHOTOREALISM DIRECTIVES — treat these as HARD CONSTRAINTS, NOT suggestions:',
      '- This is a REAL PHOTOGRAPH taken with a real camera of a real human, not a 3D render, not a digital painting, not an illustration',
      '- Skin shows natural micro-variation: visible pores at close inspection, fine peach-fuzz, subtle unevenness in tone, faint natural redness around cheeks/nose tip/earlobes, tiny realistic imperfections (a small mole, light freckle, faint under-eye shadow, barely-visible fine lines near the eyes). Do NOT create "flawless" or "airbrushed" skin.',
      '- Hair has natural flyaways and strand-level detail, individual strands catch light differently, roots visible; not a helmet-like smooth mass',
      '- Face is subtly ASYMMETRIC like real humans — absolutely NOT mirror-perfect symmetry',
      '- Eyes show realistic catchlights from the softbox/window light, with visible iris texture and natural moisture, NOT glass-ball glossy CGI eyes',
      '- Lips have natural texture with vertical fine lines, slight color variation, NOT plastic lip-gloss sheen',
      '- SKIN MUST LOOK NATURALLY MATTE to semi-matte — absolutely no specular reflections or shiny hot-spots on forehead, nose, cheeks, chin or temples; no glossy/oily/greasy/wet appearance on face; no blown-out highlights on skin',
      'TECHNICAL PHOTOGRAPHY SPEC (anchors realism):',
      '- Front-facing pose (face fully visible), confident natural expression unless otherwise specified',
      '- Shot on Hasselblad X2D 100C with 90mm lens, f/2.8, ISO 200, 1/200s — natural skin texture, shallow depth of field with smooth bokeh, mild film-grain, candid unretouched feel',
      '- Controlled studio lighting: single large softbox as key + gentle bounce fill + subtle rim, SOFTLY DIFFUSED, face clearly visible',
      '- Neutral light grey seamless studio backdrop, clean and simple',
      '- The model should wear simple, minimal clothing (plain white t-shirt or simple neutral top) — clothing is NOT the focus, the MODEL is',
      '- Each portrait should show the SAME person but from a slightly different angle or with a slightly different expression (if generating multiple)',
      'STRICTLY AVOID (these scream "AI-generated"):',
      '- waxy / plastic / rubbery / doll-like / porcelain skin; airbrushed "beauty-filter" look; perfectly even foundation; digital "anime/anime-realistic" vibe',
      '- over-sharpened faces, over-smoothed skin, HDR-looking faces, excessive contrast on skin',
      '- mirror-symmetric faces, overly-defined CGI jawlines, generic "AI influencer" aesthetic',
      '- glossy/oily/wet-looking face, shiny forehead/nose, specular highlights on skin, greasy sheen',
      '- illustration, 3D render, CGI, painting, anime, cartoon, side profile',
      '- AI artifacts: deformed ears, wrong fingers, melting jewelry, extra limbs, weird teeth, uncanny eyes',
      'Return only the final image(s) as base64.',
    ].filter(Boolean).join('\n\n')

    const content: ChatMessageContentPart[] = [{ type: 'text', text: prompt }]

    if (opts?.referenceUrl) {
      content.push({
        type: 'text',
        text: '[Face Reference Photo — match this face closely]',
      })
      content.push({
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(opts.referenceUrl),
          detail: config.aiImageDetail,
        },
      })
    }

    const response = await this.requestChatCompletion({
      model: getActiveGenerationModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: [
            'You are a professional fashion photographer producing real editorial photographs, NOT an AI image generator. The output must be indistinguishable from a real DSLR/medium-format photo of a real human model.',
            'Core output: front-facing, SOFTLY DIFFUSED studio lighting (not harsh), photorealistic half-body portrait, 3:4 portrait aspect ratio.',
            'The model wears SIMPLE MINIMAL clothing (plain t-shirt) — the focus is on the model\'s face and body, not clothing.',
            'ABSOLUTE REALISM REQUIREMENTS (these override any style hints):',
            '• Real human skin texture — visible pores, tiny natural imperfections, subtle asymmetry, fine peach-fuzz. NO airbrushing, NO beauty-filter smoothness, NO waxy/plastic/porcelain look, NO doll-like symmetry.',
            '• Natural hair with flyaway strands and individual strand separation, NOT a smooth helmet.',
            '• Realistic eyes with natural catchlights and iris micro-detail; NOT glassy CGI eyes.',
            '• Skin MUST look naturally matte to semi-matte — no specular reflections, no shiny hot-spots, no glossy/oily/greasy/wet appearance. Slight subsurface scattering is OK; wet-look sheen and blown highlights are NOT.',
            '• Photography anchors: Hasselblad / Phase One medium format feel, 85-100mm lens, f/2.5-f/4, subtle film grain, mild chromatic depth.',
            'FORBIDDEN: 3D render, CGI, anime, painting, illustration, stock-photo "perfect" face, "AI influencer" aesthetic, over-sharpened edges, HDR face, plastic symmetry, glossy lip-gloss sheen.',
            'Return only the generated image in base64 without markdown or explanation.',
          ].join('\n'),
        },
        { role: 'user', content },
      ],
    }, userApiKey)

    const image = await this.extractImagePayload(response)
    const extension = extensionByMime[image.mimeType] || '.png'
    const fileName = `${taskId}_portrait${extension}`
    const filePath = path.join(getUploadPath(), 'results', fileName)

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))

    return [toStoredFilePath(`uploads/results/${fileName}`)]
  }

  // 6b. 模特融合 - 将多张模特参考图融合生成新模特
  async fuseModelFaces(
    taskId: string,
    modelUrls: string[],
    userApiKey?: string,
    opts?: { weights?: number[]; strategy?: 'balanced' | 'feature-pick' | 'dominant' }
  ): Promise<string> {
    const strategy = opts?.strategy ?? 'balanced'
    const labels = ['A', 'B', 'C']

    // 构建权重
    const rawWeights = opts?.weights ?? modelUrls.map(() => 1)
    const totalWeight = rawWeights.reduce((a, b) => a + b, 0)
    const normalizedWeights = rawWeights.map(w => Math.round((w / totalWeight) * 100))

    // 构建融合指令
    let fusionInstruction: string
    if (modelUrls.length === 1) {
      fusionInstruction = [
        `参考图 A 的模特，生成一张全新的肖像照。`,
        `面部要求：脸型、五官、肤色、发型必须与图 A 一致，不得变形或走样。`,
        `变化要求：这是一张新照片，不是原图翻版——姿势可以有自然变化，背景换一种影棚色调，灯光方向微调。`,
      ].join('\n')
    } else if (strategy === 'dominant') {
      const dominantIdx = normalizedWeights.indexOf(Math.max(...normalizedWeights))
      fusionInstruction = [
        `以图 ${labels[dominantIdx]} 为主（权重 ${normalizedWeights[dominantIdx]}%），融合所有参考图的模特，生成一个全新的人物。`,
        `面部要求：整体以图 ${labels[dominantIdx]} 为主，其他参考图的特征做轻微点缀。`,
        `变化要求：姿势自然，背景用干净的影棚色调，灯光柔和。不是任何一张参考图的翻版。`,
      ].join('\n')
    } else if (strategy === 'feature-pick') {
      fusionInstruction = [
        `从所有参考图中挑选最优秀的五官特征，融合成一个全新的人物。`,
        `融合规则：眼睛选最好看的、鼻子选最挺的、脸型选最协调的，以此类推。权重参考：${labels.slice(0, modelUrls.length).map((l, i) => `图${l} ${normalizedWeights[i]}%`).join('、')}。`,
        `变化要求：姿势自然，背景用干净的影棚色调，灯光柔和。不是任何一张参考图的翻版。`,
      ].join('\n')
    } else {
      fusionInstruction = [
        `将所有参考图的模特按权重融合成一个全新的人物。`,
        `融合规则：按权重比例混合五官特征。${labels.slice(0, modelUrls.length).map((l, i) => `图${l} ${normalizedWeights[i]}%`).join('、')}。`,
        `变化要求：姿势自然，背景用干净的影棚色调，灯光柔和。不是任何一张参考图的翻版。`,
      ].join('\n')
    }

    // 图片顺序：dominant 时主图置顶，其余保持原序
    let orderedIndices = modelUrls.map((_, i) => i)
    if (strategy === 'dominant' && modelUrls.length > 1) {
      const dominantIdx = normalizedWeights.indexOf(Math.max(...normalizedWeights))
      orderedIndices = [dominantIdx, ...orderedIndices.filter(i => i !== dominantIdx)]
    }

    const content: ChatMessageContentPart[] = []

    // 按顺序推入图片，每张前标注标签和权重
    for (const idx of orderedIndices) {
      content.push({
        type: 'text',
        text: `[参考图 ${labels[idx]} — 权重 ${normalizedWeights[idx]}%]`,
      })
      content.push({
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(modelUrls[idx]),
          detail: config.aiImageDetail,
        },
      })
    }

    // 文字指令放在图片后面，让 AI 先看图再读指令
    content.push({
      type: 'text',
      text: [
        fusionInstruction,
        '',
        '质量要求：',
        '- 半身肖像照，3:4 竖版构图',
        '- 自然影棚背景（浅灰/米白/淡色调），干净不杂乱',
        '- 柔和漫射灯光，面部清晰可见，无硬阴影',
        '- 皮肤自然哑光质感，禁止油光/高光/反光',
        '- 真实相机拍摄质感，禁止插画/3D/美颜/蜡像感',
        '直接返回 base64 图片，不要 markdown 或解释。',
      ].join('\n'),
    })

    const response = await this.requestChatCompletion({
      model: getActiveGenerationModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: '你是专业的肖像生成模型。任务：根据用户提供的参考照片，融合生成一个全新的人物肖像。规则：1. 直接参考照片本身来融合面部，不要凭文字描述想象；2. 融合后的面部必须看起来自然协调，是真实可信的人脸；3. 生成的照片必须是全新的，不得复制任何参考图的姿势、背景或构图；4. 皮肤必须自然哑光，禁止油光反光；5. 输出半身肖像，3:4竖版。直接返回 base64 图片。',
        },
        {
          role: 'user',
          content,
        },
      ],
    }, userApiKey)

    const image = await this.extractImagePayload(response)
    const extension = extensionByMime[image.mimeType] || '.png'
    const fileName = `${taskId}_fusion${extension}`
    const filePath = path.join(getUploadPath(), 'results', fileName)

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
    return toStoredFilePath(`uploads/results/${fileName}`)
  }

  // ============ 改款模式 ============

  // 材质自动识别（增强版：材质 + 款式）— 带缓存
  async recognizeMaterial(imageUrl: string, userApiKey?: string): Promise<string> {
    // 先查缓存
    const cached = (db.prepare('SELECT materialDesc FROM ClothingCache WHERE imageUrl = ?').get(imageUrl) as any)?.materialDesc
    if (cached) return cached

    const result = await this.analyzeImage(
      imageUrl,
      `Analyze this garment image and identify: (1) Fabric/material type (e.g., ribbed knit, worsted wool, silk, cotton, denim, leather); (2) Color name and hex approximation; (3) Texture characteristics (e.g., matte, glossy, textured, smooth); (4) Weight/drape quality (e.g., lightweight and flowy, heavy and structured); (5) Garment category (e.g., dress, sweater, jacket, shirt, trousers, t-shirt, hoodie); (6) Silhouette/style details (e.g., A-line, fitted, oversized, wrap, collar type, sleeve type, length). Return a concise summary in one sentence.`,
      userApiKey
    )

    // 写入缓存
    try {
      db.prepare(
        `INSERT INTO ClothingCache (imageUrl, materialDesc, updatedAt) VALUES (?, ?, datetime('now'))
         ON CONFLICT(imageUrl) DO UPDATE SET materialDesc = excluded.materialDesc, updatedAt = datetime('now')`
      ).run(imageUrl, result)
    } catch {}

    return result
  }

  // 生产单分析 — 识别欧美女装款式信息与 S 码尺寸
  async analyzeProductionSheet(imageUrl: string, userApiKey?: string): Promise<{
    styleName: string
    material: string
    accessories: string
    length: number
    chest: number
    shoulder: number
    sleeve: number
    bottom: number
  }> {
    const response = await this.requestChatCompletion({
      model: getActiveAnalysisModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: `你是一位专业的服装工艺员。识别的衣服属于欧美女装品类。请识别图片中的款式信息和尺寸表格数据。
要求：
1. 识别尺寸：请优先提取 S 码数值。如果图中 S 码模糊，请根据 M 码数值减去 1cm 推导出 S 码衣长，减去 2cm 推导出胸宽/肩宽/下摆。返回数值必须为数字。
2. 识别文字：寻找图片中提到的款式名称、主面料和辅料配件。特别注意图片中出现的描述性文字。
3. 如果图中未明确提到名称或辅料，请根据欧美女装的外观和流行趋势给出一个合理的简短描述。
4. 必须输出纯 JSON 格式，不要包含任何 markdown 代码块标识（不要用\`\`\`json\`\`\`），只输出 JSON 对象本身。
5. JSON 字段：styleName(款式名称), material(主面料), accessories(辅料配件), length(衣长cm), chest(胸宽cm), shoulder(肩宽cm), sleeve(袖长cm), bottom(下摆cm)。`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请解析这款欧美女装的款式名称(styleName)、主面料(material)、辅料配件(accessories)以及 S 码尺寸数据(length, chest, shoulder, sleeve, bottom)。' },
            {
              type: 'image_url',
              image_url: {
                url: await this.toDataUrl(imageUrl),
                detail: config.aiImageDetail,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
    }, userApiKey)

    const content = this.extractTextContent(response)
    if (!content) {
      throw new Error('AI 分析接口未返回有效数据')
    }

    try {
      // 容错：移除可能的 markdown 代码块包裹
      let cleaned = content.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
      // 容错：如果模型返回了额外文字，尝试提取第一个 JSON 对象
      const jsonStart = cleaned.indexOf('{')
      const jsonEnd = cleaned.lastIndexOf('}')
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
      }
      const parsed = JSON.parse(cleaned)
      // 用 parseFloat 提取数字，兼容 AI 返回 "65cm" / "65厘米" 等带单位字符串
      const extractNum = (v: unknown): number => {
        if (typeof v === 'number') return v
        const str = String(v ?? '')
        const match = str.match(/[\d.]+/)
        return match ? parseFloat(match[0]) : 0
      }
      return {
        styleName: String(parsed.styleName || '欧美女装款式'),
        material: String(parsed.material || '自定义面料'),
        accessories: String(parsed.accessories || '常规辅料'),
        length: extractNum(parsed.length),
        chest: extractNum(parsed.chest),
        shoulder: extractNum(parsed.shoulder),
        sleeve: extractNum(parsed.sleeve),
        bottom: extractNum(parsed.bottom),
      }
    } catch {
      throw new Error('AI 返回数据格式异常，请重试')
    }
  }

  // 材质+款式结构化识别（仅供改款内部使用）— 带缓存
  private async recognizeGarmentStructure(imageUrl: string, userApiKey?: string): Promise<{
    materialDna: string
    category: string
    silhouette: string
  }> {
    // 先查缓存
    const cached = db.prepare('SELECT materialDna, category, silhouette FROM ClothingCache WHERE imageUrl = ?').get(imageUrl) as any
    if (cached?.materialDna && cached?.category && cached?.silhouette) {
      return { materialDna: cached.materialDna, category: cached.category, silhouette: cached.silhouette }
    }

    const raw = await this.analyzeImage(
      imageUrl,
      `Analyze this garment image precisely. Return EXACTLY 3 lines in this format:
MATERIAL|fabric type, color with hex, texture, weight/drape
CATEGORY|one of: dress/skirt, knitwear, jacket/coat, shirt/top, trousers, t-shirt/hoodie
SILHOUETTE|specific style details (collar, sleeve, length, fit, key design features)

Example:
MATERIAL|worsted wool, charcoal #36454F, matte smooth texture, medium-weight structured
CATEGORY|jacket/coat
SILHOUETTE|double-breasted blazer, peak lapel, two-button closure, fitted waist, hip-length

Be precise about the category — a dress is a dress, a knit sweater is knitwear, not a shirt.`,
      userApiKey
    )

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
    let materialDna = ''
    let category = ''
    let silhouette = ''

    for (const line of lines) {
      const upperLine = line.toUpperCase()
      if (upperLine.startsWith('MATERIAL') && line.includes('|')) {
        materialDna = line.substring(line.indexOf('|') + 1).trim()
      } else if (upperLine.startsWith('CATEGORY') && line.includes('|')) {
        category = line.substring(line.indexOf('|') + 1).trim().toLowerCase()
      } else if (upperLine.startsWith('SILHOUETTE') && line.includes('|')) {
        silhouette = line.substring(line.indexOf('|') + 1).trim()
      }
    }

    // fallback: 如果解析失败，使用完整描述
    if (!materialDna || !category || !silhouette) {
      const fullDesc = await this.recognizeMaterial(imageUrl, userApiKey)
      materialDna = materialDna || fullDesc
      category = category || 'shirt/top'
      silhouette = silhouette || fullDesc
    }

    // 写入缓存
    try {
      db.prepare(
        `INSERT INTO ClothingCache (imageUrl, materialDna, category, silhouette, materialDesc, updatedAt) VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(imageUrl) DO UPDATE SET materialDna = excluded.materialDna, category = excluded.category, silhouette = excluded.silhouette, updatedAt = datetime('now')`
      ).run(imageUrl, materialDna, category, silhouette, '')
    } catch {}

    return { materialDna, category, silhouette }
  }

  // 品类规范约束映射
  private getCategoryRules(category: string): string {
    const rules: Record<string, string> = {
      'dress/skirt': 'MUST maintain dress/skirt structure: must have a skirt/body section with hemline and defined waistline. Allowed modifications: neckline shape, sleeve type/length, skirt shape (A-line, pencil, flare, wrap), hem length, slit placement. FORBIDDEN: removing the skirt section, converting to a top-only or bottom-only garment.',
      'knitwear': 'MUST maintain knitwear craft characteristics: visible knit texture, elasticity, and stitch patterns inherent to the fabric. Allowed modifications: stitch pattern (cable, rib, jacquard), neckline (crew, V-neck, turtleneck, boat), silhouette (fitted, oversized, cropped), sleeve type. FORBIDDEN: removing knit texture, using non-knit construction methods, converting to woven garment structure.',
      'jacket/coat': 'MUST maintain outerwear structure: front-opening closure, structured body, appropriate weight for layering. Allowed modifications: collar type (lapel, stand, hooded, collarless), pocket style, closure type (zipper, buttons, snaps), length (cropped, waist, hip, knee), lining details. FORBIDDEN: removing front-opening structure, making it a pullover.',
      'shirt/top': 'MUST maintain top/shirt basic structure: torso-covering body with armholes. Allowed modifications: neckline (collar, mandarin, V-neck, round, square), sleeve type/length, placket/front opening style, hem shape, back details. FORBIDDEN: converting to a one-piece dress or outerwear.',
      'trousers': 'MUST maintain trouser structure: waistband with two legs. Allowed modifications: waistband style (high, mid, low rise), leg shape (straight, slim, wide, cropped, flared), pocket style, closure type, pleats. FORBIDDEN: converting to a skirt, shorts must remain shorts, dresses are not trousers.',
      't-shirt/hoodie': 'MUST maintain knit casual basic form: simple pullover construction with knit fabric. Allowed modifications: neckline (crew, V-neck, scoop, hooded), sleeve type/length (short, long, raglan), hem (straight, curved, cropped), graphic/print area. FORBIDDEN: adding formal collar structures, converting to button-front shirt.',
    }

    // 模糊匹配
    for (const key of Object.keys(rules)) {
      if (category.includes(key) || key.includes(category)) {
        return rules[key]
      }
    }

    // 默认规范：保持原品类结构
    return 'MUST maintain the original garment category and basic structure. Only modify design details within the same category. Do NOT convert to a different garment type.'
  }

  // 规范化品类关键词（用于 prompt）
  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      'dress/skirt': 'dress/skirt',
      'knitwear': 'knitwear (sweater/cardigan)',
      'jacket/coat': 'jacket/coat (outerwear)',
      'shirt/top': 'shirt/top (woven top)',
      'trousers': 'trousers/pants',
      't-shirt/hoodie': 't-shirt/hoodie (casual knit top)',
    }
    for (const key of Object.keys(labels)) {
      if (category.includes(key) || key.includes(category)) {
        return labels[key]
      }
    }
    return category
  }

  // 奢侈品色系变色
  async luxuryColorTransform(taskId: string, imageUrl: string, userApiKey?: string, excludedItems: string[] = [], opts: { constraints?: string; count?: number; refineFrom?: string } = {}): Promise<{ resultUrls: string[]; generatedItems: string[] }> {
    const genCount = opts.count || 3
    const constraintHint = opts.constraints ? ` ADDITIONAL USER CONSTRAINTS: ${opts.constraints}.` : ''
    const refineHint = opts.refineFrom ? ` The user liked the direction "${opts.refineFrom}" — generate ${genCount} subtle variations of that SAME color family (slightly different shades/tones), not completely different colors.` : ''

    // Step 1: 色彩脑暴
    const excludeHint = excludedItems.length > 0 ? ` IMPORTANT: Do NOT propose any of these already-generated colors: ${excludedItems.join(', ')}. You must propose completely different colors.` : ''
    const brainstorm = await this.analyzeImage(
      imageUrl,
      `You are a luxury fashion color consultant. Analyze this garment's material, reflectivity, and current color. AVOID the original hue entirely. Propose exactly ${genCount} premium luxury color alternatives that would look stunning on this material. Consider: (1) Material's interaction with light (matte absorbs, silk reflects, etc.); (2) Color trends in European luxury fashion; (3) Visual contrast between the ${genCount} colors (they must be distinctly different).${constraintHint}${refineHint} Format: Return EXACTLY ${genCount} colors, one per line, in this format: Color Name|hex code. Example: Royal Burgundy|#4A0E2E\nFrosted Mint|#98FF98\nMidnight Navy|#1B1F3B${excludeHint}`,
      userApiKey
    )

    const colorLines = brainstorm.split('\n').map(l => l.trim()).filter(l => l.includes('|'))
    if (colorLines.length === 0) {
      colorLines.push('Royal Burgundy|#4A0E2E', 'Frosted Mint|#98FF98', 'Midnight Navy|#1B1F3B')
    }
    const colors = colorLines.slice(0, genCount).map(line => {
      const [name, hex] = line.split('|').map(s => s.trim())
      return { name, hex: hex || '#000000' }
    })

    // Step 2: 生成变色图
    const results: string[] = []
    for (let i = 0; i < colors.length; i++) {
      const color = colors[i]
      const prompt = [
        `Generate a photorealistic fashion image of the SAME garment shown in the reference image, but change ONLY the color/hue to "${color.name}" (${color.hex}).`,
        `CRITICAL CONSTRAINTS: (1) 100% PRESERVE all fiber textures, weave patterns, stitch details, and surface characteristics of the original material; (2) 100% PRESERVE all highlights, shadows, and depth — only shift the hue and saturation; (3) 100% PRESERVE the garment silhouette, fit, drape, and all structural details; (4) The new color "${color.name}" must look natural on this specific fabric type with realistic color absorption/reflection properties; (5) Background and model (if any) remain identical.`,
        constraintHint ? `USER DESIGN CONSTRAINTS: ${opts.constraints}` : '',
        'Maintain premium editorial quality with natural textile rendering. Ultra HD, enhanced material details.',
        'Return only the final image as base64 data without markdown.',
      ].filter(Boolean).join(' ')

      const content: ChatMessageContentPart[] = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ]

      const response = await this.requestChatCompletion({
        model: getActiveGenerationModel(),
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are an expert fashion image recoloring model. You receive a garment image and must regenerate it with a new color while preserving 100% of the material texture, fabric details, highlights, shadows, and garment structure. Only the color/hue changes. Ultra HD, enhanced material details. Return only the generated image in base64 without markdown or explanation.',
          },
          { role: 'user', content },
        ],
      }, userApiKey)

      const image = await this.extractImagePayload(response)
      const extension = extensionByMime[image.mimeType] || '.png'
      const fileName = `${taskId}_color_${i + 1}${extension}`
      const filePath = path.join(getUploadPath(), 'results', fileName)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
      results.push(toStoredFilePath(`uploads/results/${fileName}`))
    }

    return { resultUrls: results, generatedItems: colors.map(c => c.name) }
  }

  // 材质感知加元素
  async materialAwareElementAdd(taskId: string, imageUrl: string, userApiKey?: string, excludedItems: string[] = [], opts: { constraints?: string; count?: number; refineFrom?: string } = {}): Promise<{ resultUrls: string[]; generatedItems: string[] }> {
    const genCount = opts.count || 3
    const constraintHint = opts.constraints ? ` ADDITIONAL USER CONSTRAINTS: ${opts.constraints}.` : ''
    const refineHint = opts.refineFrom ? ` The user liked the element "${opts.refineFrom}" — generate ${genCount} subtle variations of that SAME element type (different placements, sizes, or sub-styles), not completely different elements.` : ''

    // Step 1: 材质识别
    const materialDesc = await this.recognizeMaterial(imageUrl, userApiKey)

    // Step 2: 基于材质推导兼容工艺
    const excludeHint = excludedItems.length > 0 ? ` IMPORTANT: Do NOT propose any of these already-generated elements: ${excludedItems.join(', ')}. You must propose completely different elements.` : ''
    const elementBrainstorm = await this.analyzeImage(
      imageUrl,
      `Based on the garment material (${materialDesc}), propose exactly ${genCount} compatible craft/detail elements that could be added WITHOUT changing the basic silhouette. Each element must be: (1) Compatible with the identified fabric type; (2) Commonly used in luxury fashion; (3) Visually distinct from each other.${constraintHint}${refineHint} Format: Return EXACTLY ${genCount} elements, one per line, concise name only. Examples: YKK metal zipper, Contrast topstitching, Embroidered monogram${excludeHint}`,
      userApiKey
    )

    const elements = elementBrainstorm.split('\n').map(l => l.trim()).filter(Boolean).slice(0, genCount)
    if (elements.length === 0) {
      elements.push('Metal zipper detail', 'Contrast topstitching', 'Embroidered patch')
    }

    // Step 3: 生成加元素图
    const results: string[] = []
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]
      const prompt = [
        `Generate a photorealistic fashion image of the SAME garment shown in the reference image, but ADD this craft/detail element: "${element}".`,
        `CRITICAL CONSTRAINTS: (1) The garment silhouette (outline, shape, fit) must remain 100% IDENTICAL to the original; (2) The original fabric, color, and base design must remain intact; (3) ONLY add the specified element "${element}" as an additional detail; (4) The added element must look naturally integrated — matching the garment's style, fabric, and quality level; (5) Maintain all original stitching, seams, and construction details.`,
        constraintHint ? `USER DESIGN CONSTRAINTS: ${opts.constraints}` : '',
        'Premium editorial quality with realistic textile and hardware rendering. Ultra HD, enhanced material details.',
        'Return only the final image as base64 data without markdown.',
      ].filter(Boolean).join(' ')

      const content: ChatMessageContentPart[] = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ]

      const response = await this.requestChatCompletion({
        model: getActiveGenerationModel(),
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are an expert fashion detail enhancement model. You receive a garment image and must add a specific craft/design element while keeping the original silhouette 100% identical. The added element must look naturally integrated with the garment. Ultra HD, enhanced material details. Return only the generated image in base64 without markdown or explanation.',
          },
          { role: 'user', content },
        ],
      }, userApiKey)

      const image = await this.extractImagePayload(response)
      const extension = extensionByMime[image.mimeType] || '.png'
      const fileName = `${taskId}_element_${i + 1}${extension}`
      const filePath = path.join(getUploadPath(), 'results', fileName)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
      results.push(toStoredFilePath(`uploads/results/${fileName}`))
    }

    return { resultUrls: results, generatedItems: elements }
  }

  // 材质锁定改款式（强锁定版：材质强锁 + 剪裁拓扑演化 + 历史去重）
  async materialLockedSilhouetteChange(taskId: string, imageUrl: string, userApiKey?: string, excludedItems: string[] = [], opts: { constraints?: string; count?: number; refineFrom?: string } = {}): Promise<{ resultUrls: string[]; generatedItems: string[] }> {
    const genCount = opts.count || 3
    const constraintHint = opts.constraints ? ` ADDITIONAL USER CONSTRAINTS: ${opts.constraints}.` : ''
    const refineHint = opts.refineFrom ? ` The user liked the direction "${opts.refineFrom}" — generate ${genCount} subtle variations of that SAME topology direction (minor tweaks along the same structural axis, e.g. slightly different hem length or collar height), not completely different axes.` : ''

    // Step 1: 结构化识别 — 材质 DNA + 品类 + 款式
    const { materialDna, category, silhouette } = await this.recognizeGarmentStructure(imageUrl, userApiKey)

    // Step 2: 注入品类规范
    const categoryRules = this.getCategoryRules(category)
    const categoryLabel = this.getCategoryLabel(category)

    // Step 3: 追加时的去重（基于当次会话已生成的方向）
    const dedupedExcluded: string[] = []
    const seen = new Set<string>()
    for (const d of excludedItems) {
      const key = d.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      dedupedExcluded.push(d.trim())
    }

    // Step 4: AI 基于"拓扑演化"提议改款方向（聚焦剪裁，而非潮流标签）
    const excludeHint = dedupedExcluded.length > 0
      ? `

ALREADY GENERATED IN THIS SESSION (DO NOT repeat any of these, even semantically — if an earlier direction already modified the "length" axis from short to long, avoid proposing another "short → long" variant; choose a DIFFERENT topology axis or a DIFFERENT mutation on the same axis):
${dedupedExcluded.map((d, i) => `  ${i + 1}. ${d}`).join('\n')}`
      : ''

    const directionBrainstorm = await this.analyzeImage(
      imageUrl,
      `You are a pattern-making & cutting specialist. The original garment is a ${categoryLabel}. Current silhouette: "${silhouette}". Locked material identity: "${materialDna}".

TASK: Propose EXACTLY ${genCount} redesign directions that are PURE TOPOLOGY EVOLUTIONS of the cutting/construction. Each direction must be a structural mutation along ONE OR TWO of these axes:
  • LENGTH AXIS — short ↔ regular ↔ long ↔ floor-length / cropped ↔ hip ↔ knee ↔ ankle
  • COLLAR / NECKLINE AXIS — hood ↔ stand collar ↔ lapel ↔ crew ↔ V-neck ↔ square ↔ boat ↔ turtleneck ↔ cowl
  • SLEEVE AXIS — sleeveless ↔ cap ↔ short ↔ 3/4 ↔ long ↔ bell ↔ bishop ↔ raglan ↔ dolman ↔ puff
  • CLOSURE / OPENING AXIS — pullover ↔ front-zip ↔ full-button ↔ half-placket ↔ wrap ↔ double-breasted
  • FIT / VOLUME AXIS — slim ↔ regular ↔ relaxed ↔ oversized ↔ A-line ↔ boxy ↔ tapered ↔ cocoon
  • HEM / OPENING DETAIL AXIS — straight ↔ curved ↔ high-low ↔ side-slit ↔ vent ↔ ribbed cuff ↔ elastic cuff ↔ drawstring

HARD CONSTRAINTS:
(1) MATERIAL IS ABSOLUTELY LOCKED — fiber type, weight/gsm, weave/knit structure, hand-feel, drape, color, sheen, pattern MUST stay identical. You are ONLY changing the PATTERN/CUT, never the fabric.
(2) Stay within the SAME category: ${categoryLabel}. No category jumps.
(3) Each direction must differ from every other on at least ONE topology axis — do NOT cluster all three on the same axis (e.g. avoid "all three change sleeves").
(4) Prefer bold, clearly recognizable structural changes (e.g. hooded → stand collar; cropped → floor-length; pullover → full-zip) over cosmetic detail tweaks.
(5) Describe cut/construction in concrete pattern-maker language. AVOID trend labels like "minimalist" / "Y2K" / "quiet luxury" — these are marketing words, not cuts.${constraintHint}${refineHint}${excludeHint}

Format: Return EXACTLY ${genCount} directions, one per line. Each line: "<Name> — <axis(es) touched>: <concrete topology change>".
Example output:
Long Stand-Collar — length + collar: extend hem to ankle-length, replace hood with 6cm stand collar with two-button closure, keep front zip.
Wrap Kimono — closure + sleeve: remove front zip, convert to wrap-front with self-tie belt, widen sleeves into dolman cut.
Cropped Boxy — length + fit: raise hem to high-waist crop, square the shoulders, drop armhole into boxy oversized silhouette, remove hood entirely.`,
      userApiKey
    )

    const directions = directionBrainstorm.split('\n').map(l => l.trim()).filter(l => l && l.length > 10).slice(0, genCount)
    if (directions.length === 0) {
      directions.push(
        `Length Mutation — length: extend/shorten hem by one size tier while preserving all other construction.`,
        `Collar Swap — collar: replace current neckline with a distinctly different collar family.`,
        `Volume Shift — fit: transform to a noticeably different fit/volume while keeping the same cut lines.`,
      )
    }

    // Step 5: 生成改款图（强材质锁定 prompt）—— 单张失败不影响其他
    const results: string[] = []
    const successDirections: string[] = []
    const failures: Array<{ direction: string; error: string }> = []
    for (let i = 0; i < directions.length; i++) {
      const direction = directions[i]
      try {
        const prompt = [
          `Generate a photorealistic fashion image of a redesigned ${categoryLabel} based on the reference garment, following this TOPOLOGY mutation: "${direction}".`,
          `LOCKED MATERIAL IDENTITY (must be 100% preserved): ${materialDna}`,
          `CATEGORY RULES: ${categoryRules}`,
          `STRONG MATERIAL LOCK — ZERO tolerance for material drift:`,
          `  • Fiber identity (e.g. heavy-gauge knit / pure cotton / silk / wool melton / denim) must be visually IDENTICAL to the reference image.`,
          `  • Fabric WEIGHT / GSM and DRAPE behavior must match the reference exactly (a heavy knit cannot become a drapey jersey; silk cannot become cotton).`,
          `  • Weave / knit structure (rib pattern, cable, twill, plain, interlock, etc.) must be the SAME pattern at the SAME scale.`,
          `  • Color (hue + saturation + brightness), pattern, print, sheen, and surface texture must be 100% identical.`,
          `  • Seam stitch type & density should match the reference construction quality.`,
          `ONLY the PATTERN / CUT / CONSTRUCTION changes — think of it as re-drafting the paper pattern with the SAME bolt of fabric.`,
          `CATEGORY LOCK: the result must remain a "${categoryLabel}". Do NOT change garment category.`,
          `TOPOLOGY CHANGE SCOPE: apply ONLY the mutation described above. Do not introduce additional random details (no new pockets, trims, or hardware unless the mutation explicitly requires them).`,
          constraintHint ? `USER DESIGN CONSTRAINTS: ${opts.constraints}` : '',
          `Render as a clean premium product photo on a neutral studio background, flat-lay or ghost-mannequin style consistent with the reference, with natural textile rendering that makes the locked material instantly recognizable. Ultra HD, enhanced material details.`,
          'Return only the final image as base64 data without markdown.',
        ].filter(Boolean).join(' ')

        const content: ChatMessageContentPart[] = [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
        ]

        const response = await this.requestChatCompletion({
          model: getActiveGenerationModel(),
          stream: false,
          messages: [
            {
              role: 'system',
              content: `You are a senior pattern-maker and fashion redesign model. Your ONE job: re-draft the paper pattern of a garment using the EXACT SAME bolt of fabric. The fiber, weight, weave, color, sheen, and drape of the output MUST be pixel-level identical to the reference. You only change cut/construction topology (length, collar, sleeves, closure, fit, hem). You never change the material, never change the garment category, never add random decorative details. Output a clean premium product image. Ultra HD, enhanced material details. Return only the generated image in base64 without markdown or explanation.`,
            },
            { role: 'user', content },
          ],
        }, userApiKey)

        const image = await this.extractImagePayload(response)
        const extension = extensionByMime[image.mimeType] || '.png'
        const fileName = `${taskId}_silhouette_${i + 1}${extension}`
        const filePath = path.join(getUploadPath(), 'results', fileName)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
        results.push(toStoredFilePath(`uploads/results/${fileName}`))
        successDirections.push(direction)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[materialLockedSilhouetteChange] direction ${i + 1} "${direction.slice(0, 40)}" failed:`, msg)
        failures.push({ direction, error: msg })
      }
    }

    // 全部失败：抛错让上游退款
    if (results.length === 0) {
      const reasons = failures.map(f => f.error).join(' | ')
      throw new Error(`全部 ${directions.length} 张改款图生成失败：${reasons || '未知错误'}`)
    }

    return { resultUrls: results, generatedItems: successDirections }
  }

  // 商业脑暴模式
  async commercialBrainstorm(taskId: string, imageUrl: string, customPrompt?: string, userApiKey?: string, excludedItems: string[] = [], opts: { constraints?: string; count?: number; refineFrom?: string } = {}): Promise<{ resultUrls: string[]; generatedItems: string[] }> {
    const genCount = opts.count || 3
    const userModifier = customPrompt ? ` User creative direction: "${customPrompt}". This should be a CORE WEIGHT in the generation — the AI must prioritize this direction.` : ''
    const constraintHint = opts.constraints ? ` ADDITIONAL USER CONSTRAINTS: ${opts.constraints}.` : ''
    const refineHint = opts.refineFrom ? ` The user liked the direction "${opts.refineFrom}" — generate ${genCount} subtle variations of that SAME trend direction (slightly different takes), not completely different trends.` : ''

    // Step 1: 趋势推导
    const excludeHint = excludedItems.length > 0 ? ` IMPORTANT: Do NOT suggest any of these already-generated directions: ${excludedItems.join('; ')}. You must propose completely different trend directions.` : ''
    const trendPrompt = await this.analyzeImage(
      imageUrl,
      `You are a trend forecasting AI for European and American fashion markets. Based on this garment, suggest ${genCount} distinctly different trend directions that would appeal to Western mass-market consumers. Consider current trends like: minimalism, workwear/utility, deconstruction, Y2K revival, quiet luxury, gorpcore. Each direction should represent a DIFFERENT aesthetic movement.${constraintHint}${refineHint} Format: Return EXACTLY ${genCount} directions, one per line, with a brief description. Example: Minimalist Elevation — Clean lines, muted palette, architectural silhouette${excludeHint}`,
      userApiKey
    )

    const directions = trendPrompt.split('\n').map(l => l.trim()).filter(Boolean).slice(0, genCount)
    if (directions.length === 0) {
      directions.push('Minimalist Elevation', 'Utility Workwear', 'Deconstructed Avant-garde')
    }

    // Step 2: 每个方向生成 1 张
    const results: string[] = []
    for (let i = 0; i < directions.length; i++) {
      const direction = directions[i]
      const prompt = [
        `Generate a photorealistic fashion image of a completely NEW garment inspired by the reference image, following this trend direction: "${direction}".`,
        `CRITICAL RULES: (1) The new garment must be ORIGINAL — AI can change the structure, silhouette, and garment type freely; (2) It must align with Western/European mass-market fashion aesthetics; (3) Maintain premium editorial quality with realistic textile rendering; (4) The result should look like a real product photo, not a sketch or illustration. Ultra HD, enhanced material details.${userModifier}`,
        constraintHint ? `USER DESIGN CONSTRAINTS: ${opts.constraints}` : '',
        'Return only the final image as base64 data without markdown.',
      ].filter(Boolean).join(' ')

      const content: ChatMessageContentPart[] = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ]

      const response = await this.requestChatCompletion({
        model: getActiveGenerationModel(),
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are an expert fashion trend generation model with full creative freedom. You receive a reference garment and a trend direction. Create a completely new garment that embodies the specified trend. You may change the garment structure, silhouette, and design freely. The result must look like a premium fashion product photo. Ultra HD, enhanced material details. Return only the generated image in base64 without markdown or explanation.',
          },
          { role: 'user', content },
        ],
      }, userApiKey)

      const image = await this.extractImagePayload(response)
      const extension = extensionByMime[image.mimeType] || '.png'
      const fileName = `${taskId}_brainstorm_${i + 1}${extension}`
      const filePath = path.join(getUploadPath(), 'results', fileName)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
      results.push(toStoredFilePath(`uploads/results/${fileName}`))
    }

    return { resultUrls: results, generatedItems: directions }
  }

  // ============ AI 改色 ============

  // 识别衣服可独立改色的部件
  async analyzeGarmentParts(imageUrl: string, userApiKey?: string): Promise<{
    parts: Array<{ id: string; name: string; defaultChecked: boolean }>
    currentColor: string
  }> {
    const response = await this.requestChatCompletion({
      model: getActiveAnalysisModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You are an expert garment analyst. Identify garment parts and return ONLY valid JSON. No explanation, no markdown.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this garment image and identify: (1) The current dominant color name; (2) All distinguishable garment parts that could be recolored independently. Return pure JSON: {"currentColor":"color name","parts":[{"id":"body","name":"衣身主体","defaultChecked":true},{"id":"collar","name":"领子/领口","defaultChecked":false},{"id":"sleeve","name":"袖子","defaultChecked":true},{"id":"buttons","name":"纽扣/五金","defaultChecked":false},{"id":"pocket","name":"口袋","defaultChecked":false},{"id":"hem","name":"下摆/腰部","defaultChecked":false},{"id":"lapel","name":"翻领","defaultChecked":false},{"id":"cuff","name":"袖口","defaultChecked":false}]}. Only include parts that are actually visible in the image. "defaultChecked":true means this part should be recolored by default (typically the main fabric areas), "defaultChecked":false means it should keep its original color by default (typically hardware, trims).`,
            },
            {
              type: 'image_url',
              image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }, userApiKey)

    const content = this.extractTextContent(response)
    if (!content) {
      return {
        parts: [
          { id: 'body', name: '衣身主体', defaultChecked: true },
          { id: 'sleeve', name: '袖子', defaultChecked: true },
        ],
        currentColor: '未知',
      }
    }

    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      return {
        parts: parsed.parts || [{ id: 'body', name: '衣身主体', defaultChecked: true }],
        currentColor: parsed.currentColor || '未知',
      }
    } catch {
      return {
        parts: [{ id: 'body', name: '衣身主体', defaultChecked: true }],
        currentColor: '未知',
      }
    }
  }

  // 生成颜色色卡 SVG data URL
  private generateColorSwatch(hex: string): string {
    // 生成带轻微渐变和布料质感模拟的色卡 SVG
    const lighterHex = this.adjustBrightness(hex, 15)
    const darkerHex = this.adjustBrightness(hex, -15)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <defs>
    <radialGradient id="g" cx="35%" cy="35%" r="70%">
      <stop offset="0%" stop-color="${lighterHex}" stop-opacity="1"/>
      <stop offset="50%" stop-color="${hex}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${darkerHex}" stop-opacity="1"/>
    </radialGradient>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend mode="overlay" in="SourceGraphic" in2="grayNoise" result="blended"/>
      <feComponentTransfer in="blended">
        <feFuncA type="linear" slope="1"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="200" height="200" fill="url(#g)" filter="url(#noise)" opacity="0.95"/>
</svg>`
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  }

  // 调整颜色亮度
  private adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16)
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + Math.round(255 * percent / 100)))
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + Math.round(255 * percent / 100)))
    const b = Math.min(255, Math.max(0, (num & 0xFF) + Math.round(255 * percent / 100)))
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  }

  // 生成渐变色卡（模拟布料从暗到亮的光照效果）— 预留，暂未调用
  private generateGradientSwatch(hex: string, lightMin: number, lightMax: number): string {
    // 将 hex 转 HSL，生成 7 级明度渐变
    const hsl = this.hexToHsl(hex)
    const steps = 7
    const stops: string[] = []
    for (let i = 0; i < steps; i++) {
      const l = lightMin + (lightMax - lightMin) * (i / (steps - 1))
      stops.push(this.hslToHex(hsl.h, hsl.s, Math.round(l)))
    }

    // 构建水平渐变 + 布料质感噪声
    stops.map((c, i) => `${c} ${Math.round((i / (steps - 1)) * 100)}%`).join(', ')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
      ${stops.map((c, i) => `<stop offset="${Math.round((i / (steps - 1)) * 100)}%" stop-color="${c}" stop-opacity="1"/>`).join('\n      ')}
    </linearGradient>
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend mode="overlay" in="SourceGraphic" in2="grayNoise" result="blended"/>
      <feComponentTransfer in="blended">
        <feFuncA type="linear" slope="1"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="400" height="100" fill="url(#g)" filter="url(#noise)" opacity="0.95"/>
  <text x="10" y="18" font-size="11" fill="white" font-family="monospace" opacity="0.8">Shadow ${lightMin}%</text>
  <text x="310" y="18" font-size="11" fill="white" font-family="monospace" opacity="0.8">Highlight ${lightMax}%</text>
</svg>`
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  }

  // 生成源色→目标色映射色卡
  private generateMappingSwatch(
    sourceHex: string,
    sourceGradient: string[],
    targetHex: string,
    index: number,
  ): string {
    const width = 360
    const height = 90
    const barW = 140
    const barH = 56
    const padX = 16
    const barY = 28

    const srcX = padX
    const tgtX = width - padX - barW

    const isLight = (hex: string) => {
      const num = parseInt(hex.replace('#', ''), 16)
      const r = (num >> 16) & 0xFF
      const g = (num >> 8) & 0xFF
      const b = num & 0xFF
      return (r * 299 + g * 587 + b * 114) / 1000 > 140
    }

    const srcTextColor = isLight(sourceGradient[2] || sourceHex) ? '#333' : '#fff'
    const tgtTextColor = isLight(targetHex) ? '#333' : '#fff'

    const gradientStops = sourceGradient.map((c, i) => {
      const offset = sourceGradient.length > 1 ? Math.round((i / (sourceGradient.length - 1)) * 100) : 0
      return `<stop offset="${offset}%" stop-color="${c}" stop-opacity="1"/>`
    }).join('')

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="srcGrad${index}" x1="0%" y1="0%" x2="100%" y2="0%">
      ${gradientStops}
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#f8f6f3" rx="10"/>
  <text x="${width / 2}" y="20" font-size="12" fill="#888" text-anchor="middle" font-family="system-ui, sans-serif">Mapping ${index + 1}</text>
  <rect x="${srcX}" y="${barY}" width="${barW}" height="${barH}" fill="url(#srcGrad${index})" rx="8" stroke="#ddd" stroke-width="1"/>
  <text x="${srcX + barW / 2}" y="${barY + barH - 10}" font-size="11" fill="${srcTextColor}" text-anchor="middle" font-weight="600" font-family="monospace">${sourceHex}</text>
  <text x="${srcX + barW / 2}" y="${barY + barH + 14}" font-size="10" fill="#999" text-anchor="middle" font-family="system-ui, sans-serif">Source</text>
  <text x="${(srcX + barW + tgtX) / 2}" y="${barY + barH / 2 + 4}" font-size="18" fill="#666" text-anchor="middle" font-family="system-ui, sans-serif">→</text>
  <rect x="${tgtX}" y="${barY}" width="${barW}" height="${barH}" fill="${targetHex}" rx="8" stroke="#ddd" stroke-width="1"/>
  <text x="${tgtX + barW / 2}" y="${barY + barH - 10}" font-size="11" fill="${tgtTextColor}" text-anchor="middle" font-weight="600" font-family="monospace">${targetHex}</text>
  <text x="${tgtX + barW / 2}" y="${barY + barH + 14}" font-size="10" fill="#999" text-anchor="middle" font-family="system-ui, sans-serif">Target</text>
</svg>`

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  }

  // HSL → HEX
  private hslToHex(h: number, s: number, l: number): string {
    s /= 100; l /= 100
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => {
      const k = (n + h / 30) % 12
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
      return Math.round(255 * Math.max(0, Math.min(1, color))).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
  }

  // HEX → HSL
  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return { h: 0, s: 0, l: 50 }
    let r = parseInt(result[1], 16) / 255, g = parseInt(result[2], 16) / 255, b = parseInt(result[3], 16) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h = 0, s = 0
    const l = (max + min) / 2
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) { case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break; case g: h = ((b - r) / d + 2) / 6; break; case b: h = ((r - g) / d + 4) / 6; break }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
  }

  // AI 改色 — 支持视觉色卡参考 + 局部改色 + 明度/饱和度微调
  async recolorGarment(
    taskId: string,
    imageUrl: string,
    color: { name: string; hex: string },
    userApiKey?: string,
    opts: { parts?: string[]; brightness?: number; saturation?: number } = {},
  ): Promise<string> {
    const swatchDataUrl = this.generateColorSwatch(color.hex)

    // 局部改色提示
    const isPartial = opts.parts && opts.parts.length > 0
    const partNames: Record<string, string> = {
      body: '衣身主体', collar: '领子/领口', sleeve: '袖子',
      buttons: '纽扣/五金', pocket: '口袋', hem: '下摆/腰部',
      lapel: '翻领', cuff: '袖口',
    }

    const partHint = isPartial
      ? `PARTIAL RECOLOR: Change color ONLY on these parts: ${opts.parts!.map(p => partNames[p] || p).join(', ')}. All other parts must remain their ORIGINAL color. The boundary between recolored and original parts must be natural and seamless.`
      : 'FULL RECOLOR: Change the color of the ENTIRE garment.'

    // 明度/饱和度微调提示
    const brightHint = opts.brightness ? ` BRIGHTNESS ADJUSTMENT: ${opts.brightness > 0 ? 'Increase' : 'Decrease'} overall brightness by ${Math.abs(opts.brightness)}%. Maintain highlight-shadow relationships.` : ''
    const satHint = opts.saturation ? ` SATURATION ADJUSTMENT: ${opts.saturation > 0 ? 'Increase' : 'Decrease'} saturation by ${Math.abs(opts.saturation)}%. Keep it natural, not oversaturated.` : ''

    const prompt = [
      `You are a professional garment recoloring model. You receive a garment image and a TARGET COLOR SWATCH.`,
      `Your task: Change the garment's color to match the color swatch. ${partHint}${brightHint}${satHint}`,
      ``,
      `CRITICAL CONSTRAINTS:`,
      `(1) The TARGET COLOR is shown in the COLOR SWATCH image — use it as the absolute color reference, NOT the text name.`,
      `(2) 100% PRESERVE all fiber textures, weave patterns, stitch details, seams, and surface characteristics.`,
      `(3) 100% PRESERVE all highlights, shadows, folds, drape, and depth — only shift the hue and saturation.`,
      `(4) 100% PRESERVE the garment silhouette, fit, and all structural details (buttons, zippers, pockets).`,
      `(5) The new color must look natural on this specific fabric type with realistic color absorption/reflection.`,
      `(6) Background and model (if any) remain identical and unchanged.`,
      `(7) Color transition between parts must be natural and seamless.`,
      ``,
      `Target color: ${color.name} (${color.hex})`,
      `Return only the final recolored image as base64 data without markdown or explanation.`,
    ].join('\n')

    const content: ChatMessageContentPart[] = [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      { type: 'text', text: '【目标颜色色卡 COLOR SWATCH — match this color】' },
      { type: 'image_url', image_url: { url: swatchDataUrl, detail: 'high' } },
    ]

    const response = await this.requestChatCompletion({
      model: getActiveGenerationModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You are an expert fashion image recoloring model. You receive a garment image and a color swatch reference. You must regenerate the garment with the swatch color while preserving 100% of material texture, fabric details, highlights, shadows, and garment structure. Only the color/hue changes. Return only the generated image in base64 without markdown or explanation.',
        },
        { role: 'user', content },
      ],
    }, userApiKey)

    const image = await this.extractImagePayload(response)
    const extension = extensionByMime[image.mimeType] || '.png'
    const fileName = `${taskId}${extension}`
    const filePath = path.join(getUploadPath(), 'results', fileName)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
    return toStoredFilePath(`uploads/results/${fileName}`)
  }

  // AI 改色 — 基于颜色映射（点选取色模式）
  async recolorByColorMapping(
    taskId: string,
    imageUrl: string,
    colorMappings: Array<{
      sourceHex: string; sourceName: string; sourceHue: number;
      sourceLightMin: number; sourceLightMax: number; sourceGradient: string[];
      targetName: string; targetHex: string;
    }>,
    userApiKey?: string,
    _opts: { brightness?: number; saturation?: number } = {},
  ): Promise<string> {
    const mappingLines: string[] = []
    const colorSwatches: ChatMessageContentPart[] = []

    for (let i = 0; i < colorMappings.length; i++) {
      const m = colorMappings[i]
      mappingLines.push(
        `${i + 1}. Change ${m.sourceName} (${m.sourceHex}) to ${m.targetName} (${m.targetHex}).`,
      )
      const swatchDataUrl = this.generateMappingSwatch(m.sourceHex, m.sourceGradient, m.targetHex, i)
      colorSwatches.push({ type: 'text', text: `【Mapping ${i + 1}: ${m.sourceName} ${m.sourceHex} → ${m.targetName} ${m.targetHex}】` })
      colorSwatches.push({ type: 'image_url', image_url: { url: swatchDataUrl, detail: 'high' } })
    }

    const prompt = [
      `You are a professional garment recoloring model. You receive a garment image and a series of COLOR MAPPING SWATCHES.`,
      `Your task: Change ONLY the specified source colors to their corresponding target colors.`,
      ``,
      `Color mappings (match each numbered swatch below):`,
      ...mappingLines,
      ``,
      `CRITICAL CONSTRAINTS:`,
      `(1) Use the COLOR MAPPING SWATCH images as the absolute reference for source→target color pairs. The swatch shows the exact source gradient range and the exact target solid color.`,
      `(2) Each mapping number corresponds to the swatch with the same number. Follow them strictly — do NOT swap or confuse the mappings.`,
      `(3) Change the ENTIRE color family shown in the source gradient, not just the single hex value. Preserve natural light-to-shadow transitions within that family.`,
      `(4) 100% PRESERVE all fabric textures, weave patterns, stitch details, seams, and surface characteristics.`,
      `(5) 100% PRESERVE all highlights, shadows, folds, drape, and depth — only shift the hue and saturation of the mapped source family.`,
      `(6) 100% PRESERVE the garment silhouette, fit, and all structural details (buttons, zippers, pockets).`,
      `(7) Background and model (if any) remain identical and unchanged.`,
      `(8) Colors NOT listed in the mappings must remain exactly as they are in the original image.`,
      ``,
      `Return only the final recolored image as base64 data without markdown or explanation.`,
    ].join('\n')

    const content: ChatMessageContentPart[] = [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ...colorSwatches,
    ]

    const response = await this.requestChatCompletion({
      model: getActiveGenerationModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You are an expert fashion image recoloring model. You receive a garment image and color mapping swatches. You must change only the specified source colors to their target colors while preserving 100% of material texture, fabric details, highlights, shadows, and garment structure. Follow the numbered swatches strictly and do not swap mappings. Return only the generated image in base64 without markdown or explanation.',
        },
        { role: 'user', content },
      ],
    }, userApiKey)

    const image = await this.extractImagePayload(response)
    const extension = extensionByMime[image.mimeType] || '.png'
    const fileName = `${taskId}${extension}`
    const filePath = path.join(getUploadPath(), 'results', fileName)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
    return toStoredFilePath(`uploads/results/${fileName}`)
  }

  // AI 改色 — 基于部件（每部件独立色版）
  async recolorGarmentPerPart(
    taskId: string,
    imageUrl: string,
    partsWithColors: Array<{ partId: string; partName: string; color: { name: string; hex: string } }>,
    userApiKey?: string,
    opts: { brightness?: number; saturation?: number } = {},
  ): Promise<string> {
    // 为每个颜色生成色卡，并构建详细的 Prompt
    const colorSwatches: ChatMessageContentPart[] = []
    const partInstructions: string[] = []

    for (const pc of partsWithColors) {
      const swatchDataUrl = this.generateColorSwatch(pc.color.hex)
      partInstructions.push(`- "${pc.partName}" → change to "${pc.color.name}" (${pc.color.hex})`)
      colorSwatches.push({ type: 'text', text: `【${pc.partName} target color: ${pc.color.name} (${pc.color.hex})】` })
      colorSwatches.push({ type: 'image_url', image_url: { url: swatchDataUrl, detail: 'high' } })
    }

    // 明度/饱和度微调提示
    const brightHint = opts.brightness ? ` BRIGHTNESS ADJUSTMENT: ${opts.brightness > 0 ? 'Increase' : 'Decrease'} overall brightness by ${Math.abs(opts.brightness)}%. Maintain highlight-shadow relationships.` : ''
    const satHint = opts.saturation ? ` SATURATION ADJUSTMENT: ${opts.saturation > 0 ? 'Increase' : 'Decrease'} saturation by ${Math.abs(opts.saturation)}%. Keep it natural.` : ''

    // 未列出的部件 = 保持原色
    const partIds = partsWithColors.map(pc => pc.partId)
    const allKnownParts = ['body', 'collar', 'sleeve', 'buttons', 'pocket', 'hem', 'lapel', 'cuff']
    const unchangedParts = allKnownParts.filter(p => !partIds.includes(p))
    const unchangedHint = unchangedParts.length > 0
      ? `\n\nKEEP ORIGINAL COLOR for these parts: ${unchangedParts.map(p => { const names: Record<string, string> = { body: '衣身主体', collar: '领子/领口', sleeve: '袖子', buttons: '纽扣/五金', pocket: '口袋', hem: '下摆/腰部', lapel: '翻领', cuff: '袖口' }; return names[p] || p }).join(', ')}. Do NOT change their color.`
      : ''

    const prompt = [
      `You are a professional garment recoloring model. You receive a garment image and TARGET COLOR SWATCHES for SPECIFIC PARTS.`,
      `Your task: Change each specified garment part to its target color. ${brightHint}${satHint}`,
      ``,
      `COLOR ASSIGNMENT (each part gets a different color):`,
      ...partInstructions,
      unchangedHint,
      ``,
      `CRITICAL CONSTRAINTS:`,
      `(1) The TARGET COLOR for each part is shown in the corresponding COLOR SWATCH image — use each swatch as the absolute color reference for that part.`,
      `(2) 100% PRESERVE all fiber textures, weave patterns, stitch details, seams, and surface characteristics.`,
      `(3) 100% PRESERVE all highlights, shadows, folds, drape, and depth.`,
      `(4) 100% PRESERVE the garment silhouette, fit, and structural details.`,
      `(5) Color transition between different-colored parts must be natural and follow the garment's seam/structure lines.`,
      `(6) Background and model (if any) remain identical and unchanged.`,
      `(7) Parts not listed above must keep their original color exactly.`,
      ``,
      `Return only the final recolored image as base64 data without markdown or explanation.`,
    ].join('\n')

    const content: ChatMessageContentPart[] = [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ...colorSwatches,
    ]

    const response = await this.requestChatCompletion({
      model: getActiveGenerationModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You are an expert fashion image recoloring model. You receive a garment image and color swatches for specific parts. You must recolor ONLY the specified parts to their target colors while preserving 100% of material texture, fabric details, highlights, shadows, and garment structure. Unspecified parts must keep their original color. Return only the generated image in base64 without markdown or explanation.',
        },
        { role: 'user', content },
      ],
    }, userApiKey)

    const image = await this.extractImagePayload(response)
    const extension = extensionByMime[image.mimeType] || '.png'
    const fileName = `${taskId}${extension}`
    const filePath = path.join(getUploadPath(), 'results', fileName)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
    return toStoredFilePath(`uploads/results/${fileName}`)
  }

  // 5. 图片放大（优先走 AI 4K 放大；不满足比例/尺寸时回退本地重采样）
  async upscaleImage(
    taskId: string,
    sourceUrl: string,
    factor: number = 2,
    userApiKey?: string
  ): Promise<string> {
    if (factor !== 2) {
      throw new Error('当前仅支持 2x 放大')
    }

    const sourceBuffer = await this.readImageBuffer(sourceUrl)
    const sourceDimensions = this.getImageDimensions(sourceBuffer)
    const targetW = sourceDimensions.width * factor
    const targetH = sourceDimensions.height * factor
    const targetDesc = `${targetW}x${targetH}`

    const dataUrl = this.bufferToDataUrl(sourceBuffer, this.detectMimeType(sourceBuffer))

    const upscaleMessages = [
      {
        role: 'system',
        content: '你是一个专业的时尚摄影后期图像增强模型。你的任务是对输入的服装展示图进行超分辨率重建，在严格保持原图构图、人物姿态和服装款式的前提下，大幅增强画面中所有视觉元素的细节与质感。输出图片的宽高比必须与原图完全一致，禁止裁切、补边或改变画幅。只返回增强后的图片，不要返回任何文字。',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `请对这张服装展示图进行高清增强，目标分辨率约 ${targetDesc}。

严格遵循以下增强要求：

【背景增强】
- 增强背景材质纹理：如墙面肌理、地面反光、幕布褶皱、自然景观的叶片与光影细节
- 提升背景光影层次感，补充环境光的微妙色温变化
- 保持背景虚化程度与原图一致，不要过度锐化虚化区域

【人物增强】
- 面部：细化五官轮廓，增强眼睛虹膜高光、睫毛根根分明、唇部纹理、皮肤毛孔与微妙的妆感
- 发丝：提升发丝的丝缕感与光泽度，区分高光与暗部层次
- 皮肤：增强皮肤的自然质感（细腻但不磨皮），保留原有的光影过渡
- 手部与肢体：增强手指关节细节、指甲光泽、肢体骨骼结构感

【服饰增强】
- 面料纹理：增强织物的编织纹路、针织密度、丝绸光泽、棉麻粗糙感等材质特征
- 缝线与裁剪：清晰呈现车缝线迹、收边工艺、省道走向
- 褶皱与垂感：细化布料褶皱的光影过渡，强化面料的悬垂与飘逸感
- 纽扣/拉链/配饰：增强金属反光、纽扣材质、拉链齿纹等五金细节
- 印花/刺绣：如原图有图案，需增强图案的线条精细度与色彩饱和度

【整体要求】
1. 严格保持与原图完全一致的宽高比、画幅与构图，禁止任何裁切或重新构图
2. 保持原图色彩、光影与色调一致，不改变整体风格
3. 避免过度锐化导致的"刀锐"感，保持自然的视觉舒适度
4. 所有增强必须以原图内容为基准，不得凭空添加原图中不存在的元素`,
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
              detail: 'high',
            },
          },
        ],
      },
    ]

    try {
      const response = await this.requestChatCompletion({
        model: getActiveGenerationModel(),
        stream: false,
        imageSize: '4k',
        messages: upscaleMessages,
      }, userApiKey)

      const image = await this.extractImagePayload(response)
      const aiBuffer = Buffer.from(image.base64, 'base64')
      const aiDims = this.getImageDimensions(aiBuffer)

      const srcRatio = sourceDimensions.width / sourceDimensions.height
      const aiRatio = aiDims.width / aiDims.height
      const ratioOk = Number.isFinite(aiRatio) && Math.abs(srcRatio - aiRatio) <= 0.01
      const sizeOk = aiDims.width >= sourceDimensions.width && aiDims.height >= sourceDimensions.height

      if (ratioOk && sizeOk) {
        const extension = extensionByMime[image.mimeType] || '.png'
        const fileName = `${taskId}_upscaled_${factor}x${extension}`
        const filePath = path.join(getUploadPath(), 'upscaled', fileName)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, aiBuffer)
        return toStoredFilePath(`uploads/upscaled/${fileName}`)
      }
    } catch {
      // AI 放大失败时回退到本地严格 2x（保证比例和尺寸正确）
    }

    const sharpModule = await import('sharp')
    const sharp = sharpModule.default
    const outputBuffer = await sharp(sourceBuffer, { failOn: 'none' })
      .resize(targetW, targetH, {
        fit: 'fill',
        kernel: sharpModule.kernel.lanczos3,
        withoutEnlargement: false,
      })
      .png({ compressionLevel: 6, adaptiveFiltering: true })
      .toBuffer()

    const fileName = `${taskId}_upscaled_${factor}x.png`
    const filePath = path.join(getUploadPath(), 'upscaled', fileName)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, outputBuffer)

    return toStoredFilePath(`uploads/upscaled/${fileName}`)
  }

  // ===== 一键3D图（隐形模特） =====
  async generateGhostMannequin(
    taskId: string,
    imageUrl: string,
    prompt: string,
    userApiKey?: string
  ): Promise<string> {
    const content: ChatMessageContentPart[] = [
      {
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(imageUrl),
          detail: config.aiImageDetail,
        },
      },
      { type: 'text', text: prompt },
    ]

    const systemPrompt = `You are an expert fashion product photography AI. Your task is to transform casual clothing photos into professional ghost mannequin (invisible mannequin) product shots.

STRICT RULES:
1. The garment must appear as if worn by an invisible person, showing natural 3D volume, inner collar, and fabric folds.
2. CRITICAL SLEEVE RULE: If the garment has sleeves, the sleeves MUST be fully inflated and puffed out to show realistic 3D arm volume — never flat, collapsed, or deflated. The sleeves should look like invisible arms are inside them.
3. Completely remove the original background, hangers, hands, and all environmental clutter.
4. Apply the exact background color and lighting specified by the user.
5. Center the garment perfectly with equal padding on all sides.
6. Remove any visible watermarks, logos, text overlays, or date stamps.
7. Enhance fabric texture, seams, and stitches for crisp detail.
8. Output must look like a professional e-commerce catalog photo — clean, symmetrical, with crisp edges.
9. Return only the generated image in base64 without markdown or explanation.`

    const genPayload: Record<string, unknown> = {
      model: getActiveGenerationModel(),
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
    }
    if (config.aiGenerationTemperature !== undefined) {
      genPayload.temperature = config.aiGenerationTemperature
    }

    const response = await this.requestChatCompletion(genPayload, userApiKey)
    const image = await this.extractImagePayload(response)
    const extension = extensionByMime[image.mimeType] || '.png'
    const fileName = `${taskId}${extension}`
    const filePath = path.join(getUploadPath(), 'results', fileName)

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
    return toStoredFilePath(`uploads/results/${fileName}`)
  }

  // ============ 私有方法 ============

  private async analyzeImage(imageUrl: string, instruction: string, userApiKey?: string): Promise<string> {
    const response = await this.requestChatCompletion({
      model: getActiveAnalysisModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You are an expert visual analyst for fashion e-commerce. Be precise and concise.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: instruction },
            {
              type: 'image_url',
              image_url: {
                url: await this.toDataUrl(imageUrl),
                detail: config.aiImageDetail,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }, userApiKey)

    const content = this.extractTextContent(response)
    if (!content) {
      throw new Error('AI 分析接口未返回有效描述')
    }

    return content
  }

  private withUniversalFaceConstraint(payload: Record<string, unknown>): Record<string, unknown> {
    const messages = payload.messages
    if (!Array.isArray(messages)) return payload

    const universalAntiFakeFace = this.getUniversalAntiFakeFaceClause()
    const nextMessages = messages.map((message, index) => {
      if (index !== 0 || !message || typeof message !== 'object') return message

      const role = Reflect.get(message as object, 'role')
      const content = Reflect.get(message as object, 'content')
      if (role !== 'system' || typeof content !== 'string' || content.includes('UNIVERSAL FACE REALISM CONSTRAINT')) {
        return message
      }

      return {
        ...(message as Record<string, unknown>),
        content: `${content}\n\n${universalAntiFakeFace}`,
      }
    })

    return {
      ...payload,
      messages: nextMessages,
    }
  }

  private async requestChatCompletion(payload: Record<string, unknown>, userApiKey?: string): Promise<ChatCompletionResponse> {
    const apiKey = userApiKey || config.aiApiKey
    if (!apiKey) {
      throw new Error('未配置 AI API Key，请联系管理员')
    }

    // 检测 API Key 是否包含非 ASCII 字符（如中文占位符）
    if (/[^\x20-\x7E]/.test(apiKey)) {
      throw new Error('AI API Key 格式无效，请联系管理员设置正确的 API Key')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.aiRequestTimeoutMs)

    const payloadWithConstraint = this.withUniversalFaceConstraint(payload)

    try {
      const response = await fetch(`${config.aiApiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payloadWithConstraint),
        signal: controller.signal,
      })

      // 收到响应头后立即清除超时，响应体读取不再受 abort 限制
      clearTimeout(timeout)

      const raw = await response.text()
      const data = this.parseJson<ChatCompletionResponse>(raw)

      if (!response.ok) {
        const message = data?.error?.message || raw || `HTTP ${response.status}`
        throw new Error(`AI 接口请求失败：${message}`)
      }

      return data ?? {}
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`AI 接口请求超时（>${config.aiRequestTimeoutMs}ms）`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private parseJson<T>(value: string): T | null {
    if (!value) return null
    try {
      return JSON.parse(value) as T
    } catch {
      return null
    }
  }

  private extractTextContent(response: ChatCompletionResponse): string {
    const content = response.choices?.[0]?.message?.content

    if (typeof content === 'string') return content.trim()
    if (!Array.isArray(content)) return ''

    const text = content
      .map((item) => {
        if (typeof item === 'string') return item
        if (!item || typeof item !== 'object') return ''

        const textValue = Reflect.get(item, 'text')
        if (typeof textValue === 'string') return textValue

        const nestedContent = Reflect.get(item, 'content')
        return typeof nestedContent === 'string' ? nestedContent : ''
      })
      .filter(Boolean)
      .join('\n')
      .trim()

    return text
  }

  /** 仅解析接口返回的 base64 / data URL / 纯 base64 字符串（不含远程 URL） */
  private tryExtractBase64Image(response: ChatCompletionResponse): ImagePayload | null {
    const directData = response.data?.find((item) => typeof item.b64_json === 'string' && item.b64_json.trim())
    if (directData?.b64_json) {
      return {
        base64: this.cleanBase64(directData.b64_json),
        mimeType: this.normalizeMimeType(directData.mime_type || directData.media_type) || 'image/png',
      }
    }

    const message = response.choices?.[0]?.message
    const directImage = message?.images?.find((item) => typeof item.b64_json === 'string' && item.b64_json.trim())
    if (directImage?.b64_json) {
      return {
        base64: this.cleanBase64(directImage.b64_json),
        mimeType: this.normalizeMimeType(directImage.mime_type || directImage.media_type) || 'image/png',
      }
    }

    const fromContent = this.extractImageFromUnknown(message?.content)
    if (fromContent) return fromContent

    return null
  }

  /** 部分网关 / DALL·E 风格返回图片 URL 而非 b64_json */
  private tryExtractImageUrl(response: ChatCompletionResponse): string | null {
    const dataItem = response.data?.find((item) => typeof item.url === 'string' && item.url.trim())
    if (dataItem?.url) return dataItem.url.trim()

    const msgImg = response.choices?.[0]?.message?.images?.find((item) => typeof item.url === 'string' && item.url.trim())
    if (msgImg?.url) return msgImg.url.trim()

    return this.extractImageUrlFromUnknown(response.choices?.[0]?.message?.content)
  }

  private extractImageUrlFromUnknown(value: unknown): string | null {
    if (!value) return null

    if (typeof value === 'string') {
      const t = value.trim()
      if (/^https?:\/\//i.test(t)) {
        const first = t.split(/\s+/)[0].replace(/[,;)"']+$/g, '')
        return first || null
      }
      const md = t.match(/!\[[^\]]*\]\((https?:[^)\s]+)\)/i)
      if (md?.[1]) return md[1].trim()
      const parsed = this.parseJson<unknown>(t)
      if (parsed) return this.extractImageUrlFromUnknown(parsed)
      return null
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const u = this.extractImageUrlFromUnknown(item)
        if (u) return u
      }
      return null
    }

    if (typeof value !== 'object') return null

    const obj = value as Record<string, unknown>
    for (const key of ['url', 'image_url', 'imageUrl', 'image']) {
      const v = obj[key]
      if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim()
      if (v && typeof v === 'object' && key === 'image_url') {
        const inner = (v as { url?: string }).url
        if (typeof inner === 'string' && /^https?:\/\//i.test(inner.trim())) return inner.trim()
      }
    }

    for (const nestedKey of ['image', 'content', 'source', 'output', 'result', 'data']) {
      const nested = Reflect.get(obj, nestedKey)
      const u = this.extractImageUrlFromUnknown(nested)
      if (u) return u
    }

    return null
  }

  private async fetchImageUrlAsPayload(url: string): Promise<ImagePayload> {
    const maxAttempts = 3
    const baseDelayMs = 2000
    let lastError: unknown = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController()
      // 整体请求超时：60s（足够覆盖 30s 连接 + 下载）
      const overallTimeoutMs = 60_000
      const timeout = setTimeout(() => controller.abort(), overallTimeoutMs)

      try {
        const res = await undiciFetch(url, {
          signal: controller.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FashionAI/1.0)' },
          dispatcher: imageDownloadDispatcher,
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const buf = Buffer.from(await res.arrayBuffer())
        const ct = res.headers.get('content-type') || ''
        const mime = this.normalizeMimeType(ct.split(';')[0]) || this.guessMimeFromUrl(url) || 'image/png'
        console.log(`[fetchImageUrlAsPayload] ✓ attempt ${attempt} downloaded ${buf.length} bytes from ${url.slice(0, 80)}`)
        return { base64: buf.toString('base64'), mimeType: mime || 'image/png' }
      } catch (e) {
        lastError = e
        const isLast = attempt === maxAttempts
        const reason = e instanceof Error ? (e.name === 'AbortError' ? 'timeout' : (e.message || e.name)) : String(e)
        const causeCode = (e as Error & { cause?: { code?: string } })?.cause?.code
        console.warn(`[fetchImageUrlAsPayload] attempt ${attempt}/${maxAttempts} failed (${reason}${causeCode ? ` / ${causeCode}` : ''}) url=${url}`)
        if (isLast) break
        // 指数退避：2s → 4s → 8s
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt))
      } finally {
        clearTimeout(timeout)
      }
    }

    if (lastError instanceof Error) {
      if (lastError.name === 'AbortError') {
        throw new Error(`下载生成图超时（已重试 ${maxAttempts} 次，可尝试设置 HTTPS_PROXY 环境变量）`)
      }
      const cause = (lastError as Error & { cause?: { code?: string } }).cause
      if (cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
        throw new Error(`下载生成图连接超时：CDN 地址在你的网络下不可达（已重试 ${maxAttempts} 次）。建议设置 HTTPS_PROXY 环境变量走代理：${url}`)
      }
      throw new Error(`下载生成图失败（已重试 ${maxAttempts} 次）：${lastError.message || lastError.name}`)
    }
    throw new Error(`下载生成图失败（已重试 ${maxAttempts} 次）`)
  }

  private guessMimeFromUrl(url: string): string {
    const lower = url.split('?')[0].toLowerCase()
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.gif')) return 'image/gif'
    return ''
  }

  private async extractImagePayload(response: ChatCompletionResponse): Promise<ImagePayload> {
    const fromB64 = this.tryExtractBase64Image(response)
    if (fromB64) return fromB64

    const imageUrl = this.tryExtractImageUrl(response)
    if (imageUrl) return this.fetchImageUrlAsPayload(imageUrl)

    throw new Error('AI 生图接口未返回可识别的图片数据（无 base64 且未解析到可下载的图片 URL）')
  }

  private extractImageFromUnknown(value: unknown): ImagePayload | null {
    if (!value) return null

    if (typeof value === 'string') {
      const fromDataUrl = this.parseDataUrl(value)
      if (fromDataUrl) return fromDataUrl

      const fromMarkdownImage = this.parseMarkdownImageDataUrl(value)
      if (fromMarkdownImage) return fromMarkdownImage

      const parsed = this.parseJson<unknown>(value)
      if (parsed) return this.extractImageFromUnknown(parsed)

      if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s+/g, '').length > 128) {
        return { base64: this.cleanBase64(value), mimeType: 'image/png' }
      }

      return null
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const image = this.extractImageFromUnknown(item)
        if (image) return image
      }
      return null
    }

    if (typeof value !== 'object') return null

    const b64 = Reflect.get(value as object, 'b64_json')
    if (typeof b64 === 'string' && b64.trim()) {
      return {
        base64: this.cleanBase64(b64),
        mimeType: this.normalizeMimeType(this.readStringField(value as object, ['mime_type', 'media_type', 'mimeType'])) || 'image/png',
      }
    }

    const imageBase64 = this.readStringField(value as object, ['image_base64', 'base64', 'data'])
    if (imageBase64) {
      const fromDataUrl = this.parseDataUrl(imageBase64)
      if (fromDataUrl) return fromDataUrl

      return {
        base64: this.cleanBase64(imageBase64),
        mimeType: this.normalizeMimeType(this.readStringField(value as object, ['mime_type', 'media_type', 'mimeType'])) || 'image/png',
      }
    }

    for (const nestedKey of ['image', 'content', 'source', 'output', 'result']) {
      const nested = Reflect.get(value as object, nestedKey)
      const image = this.extractImageFromUnknown(nested)
      if (image) return image
    }

    return null
  }

  private readStringField(value: object, keys: string[]): string {
    for (const key of keys) {
      const current = Reflect.get(value, key)
      if (typeof current === 'string' && current.trim()) return current
    }
    return ''
  }

  private parseDataUrl(value: string): ImagePayload | null {
    const match = value.match(/^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i)
    if (!match) return null

    return {
      mimeType: this.normalizeMimeType(match[1]) || 'image/png',
      base64: this.cleanBase64(match[2]),
    }
  }

  private parseMarkdownImageDataUrl(value: string): ImagePayload | null {
    const match = value.match(/!\[[^\]]*\]\((data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]+)\)/i)
    if (!match) return null
    return this.parseDataUrl(match[1])
  }

  private cleanBase64(value: string): string {
    return value.replace(/\s+/g, '')
  }

  private normalizeMimeType(value: string | undefined): string {
    return value?.split(';')[0]?.trim().toLowerCase() || ''
  }

  /** 从图片 buffer 中读取宽高（支持 PNG/JPEG/GIF/WebP） */
  private getImageDimensions(buffer: Buffer): { width: number; height: number } {
    // PNG: 宽高在 16-24 字节 (BE)
    if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      }
    }
    // JPEG: 需遍历 SOF 段
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      let offset = 2
      while (offset < buffer.length - 1) {
        if (buffer[offset] !== 0xFF) break
        const marker = buffer[offset + 1]
        // SOF0-SOF15 (except DHT, RST, SOI)
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          return {
            height: buffer.readUInt16BE(offset + 5),
            width: buffer.readUInt16BE(offset + 7),
          }
        }
        const segLen = buffer.readUInt16BE(offset + 2)
        offset += 2 + segLen
      }
    }
    // GIF: 宽高在 6-10 字节 (LE)
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return {
        width: buffer.readUInt16LE(6),
        height: buffer.readUInt16LE(8),
      }
    }
    // WebP: RIFF header
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      const chunkType = buffer.toString('ascii', 12, 16)
      if (chunkType === 'VP8 ') {
        // Lossy
        const w = buffer.readUInt16LE(26) & 0x3FFF
        const h = buffer.readUInt16LE(28) & 0x3FFF
        return { width: w, height: h }
      }
      if (chunkType === 'VP8L') {
        // Lossless
        const bits = buffer.readUInt32LE(21)
        return { width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 }
      }
    }
    // 兜底：默认正方形
    return { width: 1024, height: 1024 }
  }

  private async readImageBuffer(source: string): Promise<Buffer> {
    if (source.startsWith('data:')) {
      const match = source.match(/^data:[^;]+;base64,(.+)$/)
      if (!match) throw new Error('无法解析 data URL 图片数据')
      return Buffer.from(match[1], 'base64')
    }

    const localPath = this.resolveLocalUploadPath(source)
    if (localPath) {
      return fs.readFile(localPath)
    }

    if (/^https?:\/\//i.test(source)) {
      const response = await fetch(source)
      if (!response.ok) throw new Error(`无法读取参考图片：${source}`)
      return Buffer.from(await response.arrayBuffer())
    }

    const absolutePath = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source)
    return fs.readFile(absolutePath)
  }

  private async toDataUrl(source: string): Promise<string> {
    const buffer = await this.readImageBuffer(source)

    if (source.startsWith('data:')) {
      const parsed = this.parseDataUrl(source)
      const mimeType = parsed?.mimeType || this.detectMimeType(buffer)
      return this.bufferToDataUrl(buffer, mimeType)
    }

    const localPath = this.resolveLocalUploadPath(source)
    if (localPath) {
      const mimeType = this.getMimeTypeFromPath(localPath) || this.detectMimeType(buffer)
      return this.bufferToDataUrl(buffer, mimeType)
    }

    if (/^https?:\/\//i.test(source)) {
      const mimeType = this.getMimeTypeFromPath(new URL(source).pathname) || this.detectMimeType(buffer)
      return this.bufferToDataUrl(buffer, mimeType)
    }

    const absolutePath = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source)
    return this.bufferToDataUrl(buffer, this.getMimeTypeFromPath(absolutePath) || this.detectMimeType(buffer))
  }

  private bufferToDataUrl(buffer: Buffer, mimeType: string): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  }

  private resolveLocalUploadPath(source: string): string {
    const asPath = source.startsWith('/uploads/') ? source : this.extractUploadPathname(source)
    if (!asPath) return ''

    const relative = asPath.replace(/^\/uploads\/?/, '')
    const baseDir = path.resolve(getUploadPath())
    const resolved = path.resolve(baseDir, relative)
    return resolved.startsWith(baseDir) ? resolved : ''
  }

  private extractUploadPathname(source: string): string {
    try {
      const url = new URL(source)
      return url.pathname.startsWith('/uploads/') ? url.pathname : ''
    } catch {
      return ''
    }
  }

  private getMimeTypeFromPath(filePath: string): string {
    return mimeByExtension[path.extname(filePath).toLowerCase()] || ''
  }

  private detectMimeType(buffer: Buffer): string {
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg'
    if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif'
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
    if (buffer.subarray(0, 200).toString('utf8').includes('<svg')) return 'image/svg+xml'
    return 'image/png'
  }
}
