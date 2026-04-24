import fs from 'fs/promises'
import path from 'path'
import { Agent, ProxyAgent, fetch as undiciFetch } from 'undici'
import { config, getUploadPath } from './config'
import { db } from './db'
import { getActiveAiModel } from './system-config'
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
import { appendNanoBananaRealismHint } from './nano-banana-realism'

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
      model: getActiveAiModel(),
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
  async describeModel(clothingUrl: string, modelConfig: ModelConfig, sceneMode?: string, userApiKey?: string): Promise<string> {
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
        'Describe the background scene AND lighting conditions in detail for photorealistic fashion photography. You MUST include: (1) location type and architecture; (2) PRIMARY LIGHT SOURCE direction (e.g., light from upper left, backlit, overhead, window light from right); (3) light color temperature (warm golden/cool blue/neutral white); (4) shadow characteristics (soft diffused/hard edged, direction and length); (5) ambient light reflections and bounce light from surrounding surfaces (color spills from walls, floor, sky); (6) atmosphere and color palette. This lighting information is CRITICAL for placing a person into this scene with photorealistic light coherence. Ignore any foreground people. Return 2-3 sentences.',
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
    clothingDescription: string,
    modelDescription: string,
    sceneDescription: string,
    modelConfig: ModelConfig,
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
    const imageUserPrompt = appendNanoBananaRealismHint(`${prompt}\n\n${universalAntiFakeFace}`, getActiveAiModel())
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
4. BACKGROUND: Preserve the exact background, lighting, and atmosphere from the scene reference.
5. DELETION: The original person in the scene reference is GONE. Do not blend their features.

LIGHTING COHERENCE: The new model must be lit by the scene's lighting — matching highlight positions, shadow angles, color temperature, and ambient reflections.

PHOTOREAL OUTPUT: Final image must look like a real composite photo — not 3D, not plastic skin, not oversharpened. Preserve subtle skin texture and natural imperfections.

Return only the generated image in base64 without markdown or explanation.`
    } else if (references.sceneConfig.sceneSource === 'upload') {
      systemPrompt = 'You are an expert fashion image generation model optimized for PHOTOREAL street-style output. You may receive up to 3 images: (1) MODEL FACE reference (if provided) — you MUST use this person\'s face, hair and skin tone for the generated model. (2) CLOTHING reference — the garment the model must wear. (3) SCENE reference — use ONLY the background and atmosphere from this image. CRITICAL LIGHTING RULES: (1) Analyze the scene reference lighting — light source direction, color temperature, shadow direction, ambient bounce light color. (2) The generated person MUST be lit by the EXACT SAME lighting as the scene: matching highlight positions on skin and hair, consistent diffuse reflection on clothing, correct subsurface scattering on skin (warm translucency in backlit, cool shadows in overcast), ambient occlusion at ground contact, and shadows cast by the person must match scene light direction. (3) NO separate or additional lighting on the person. They exist within the scene light, not in front of it. (4) If a model face image is provided, the generated person\'s face MUST match it, NOT any person in the scene reference. The scene reference provides background and lighting ONLY, ignore any people in it. OUTPUT MUST look like a real photograph: visible skin texture and pores, fine peach-fuzz, tiny tonal unevenness, natural under-eye and smile-line texture, slight facial asymmetry; no plastic/wax skin, no beauty-app smoothing, no pore erasing, no HDR glow, no illustration or 3D render look. Return only the generated image in base64 without markdown or explanation.'
    } else {
      systemPrompt = 'You are an expert fashion photographer\'s image generator: output must be indistinguishable from a real camera photo of street fashion. When a model reference image is provided, extract ONLY facial features, hair, and skin tone. The pose, expression, lighting, and aspect ratio MUST come from the text prompt, not from the reference images. IMPORTANT: Ignore the dimensions and aspect ratio of all reference images. Generate the output image with the exact aspect ratio specified in the prompt. CRITICAL REALISM: natural ambient light only (no fake studio rim), visible skin pores and micro-imperfections, soft peach-fuzz, subtle under-eye and nasolabial texture, slight face asymmetry, muted natural color grading, subtle sensor noise OK — reject plastic skin, airbrushed faces, poreless beauty-filter finish, CGI sheen, oversharpening, and illustration style. Return only the generated image in base64 without markdown or explanation.'
    }

    if (references.sceneConfig.batchVariation) {
      systemPrompt +=
        ' BATCH SERIES (CRITICAL): This image is ONE of multiple independent renders using the same garment. Because each render is independent, you MUST follow these FIXED styling rules exactly to guarantee visual consistency across all images: (1) ZERO accessories — no handbags, purses, clutches, jewelry, watches, necklaces, earrings, rings, bracelets, sunglasses, hats, headwear, belts (unless on the garment itself), scarves, or gloves. Hands must be EMPTY. (2) If lower body is visible and the garment does not cover it, use ONLY plain dark neutral trousers or jeans. (3) If feet are visible, use ONLY plain minimal shoes (simple white sneakers or nude flats). (4) ONLY vary pose and/or scene as the user text states — everything else about the outfit must be identical across renders.'
    }

    const genPayload: Record<string, unknown> = {
      model: getActiveAiModel(),
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
   * 分析纯背景图，返回「模特在这张图里站在哪 / 以什么姿势」的视觉布局建议。
   * 用于 background 模式：先读背景 → 文字蓝图 → 再合成最终图。
   */
  async analyzeBackgroundForPlacement(backgroundUrl: string, userApiKey?: string, options?: { framing?: 'auto' | 'half' | 'full'; device?: string }): Promise<string> {
    const framing = options?.framing || 'auto'
    const framingHint = framing === 'full'
      ? '\n\n【用户指定取景：全身照】请在 <posePrompt> 中明确描述"全身站立姿势"，让模特脚到头全部可见；在 <positionPrompt> 中指出画面中头顶和脚底大致的位置，确保出图能完整展示全身。'
      : framing === 'half'
      ? '\n\n【用户指定取景：半身照】请在 <posePrompt> 中描述半身（腰部以上/胸以上）的姿势与手部动作；在 <positionPrompt> 中指出头顶与腰部的画面位置，确保出图以半身为主。'
      : ''

    const devicePreset = getDevicePreset(options?.device)
    const deviceHint = devicePreset.placementHint
      ? `\n\n【拍摄器材限制】${devicePreset.placementHint}\n请让 <posePrompt> 与 <positionPrompt> 契合该器材：焦距 / 光圈 / 最佳拍摄距离会直接影响取景范围、景深感和模特在画面中的占比；如果与上方"用户指定取景"冲突，以用户指定取景为准。`
      : ''

    const instruction = `你是一个专业的场景分析与模特摆姿专家。请分析用户提供的场景图片（空白场景，无人物），重点关注：

1. 场景类型与风格（室内/室外、装修风格、氛围）
2. 光线条件（光源方向、光线质感、阴影分布）
3. 空间布局（前景/中景/后景区分、视觉焦点位置）
4. 构图美学（黄金分割点、视觉引导线、留白区域）

基于以上分析，输出两部分提示词（用 XML 标签包裹）：

<posePrompt>
描述模特最适合的姿势、动作、神态。包括：
- 身体姿态（站姿/坐姿/行走/倚靠等）
- 四肢动作（手部位置、腿部姿势）
- 头部朝向与表情
- 整体动态感（自然/优雅/活力等）
</posePrompt>

<positionPrompt>
描述模特在场景中的最佳位置，包括：
- 具体站位（画面左侧/右侧/中央等）
- 与场景元素的关系（靠近窗户、站在沙发旁等）
- 景深层次（前景突出/融入背景）
- 与光线的互动（面向光源/背光/侧光）
</positionPrompt>

请用中文输出，描述要具体且符合场景氛围。${framingHint}${deviceHint}`
    const raw = await this.analyzeImage(backgroundUrl, instruction, userApiKey)
    return this.normalizeQuickWorkspaceBlueprint(raw)
  }

  /** 从 AI 输出中抽取 <posePrompt> / <positionPrompt>，拼成结构化蓝图。抽取失败时退回原文。 */
  private normalizeQuickWorkspaceBlueprint(raw: string): string {
    const text = raw?.trim?.() || ''
    if (!text) return ''
    const poseMatch = text.match(/<posePrompt>([\s\S]*?)<\/posePrompt>/i)
    const posMatch = text.match(/<positionPrompt>([\s\S]*?)<\/positionPrompt>/i)
    const pose = poseMatch?.[1]?.trim() || ''
    const position = posMatch?.[1]?.trim() || ''
    if (!pose && !position) return text
    const parts: string[] = []
    if (position) parts.push(`【模特位置】${position}`)
    if (pose) parts.push(`【模特姿势】${pose}`)
    return parts.join('\n')
  }

  /**
   * 分析含人物的图：返回 (1) 原人物的位置/姿势蓝图；(2) 背景本身的简洁描述。
   * 用于 fusion 模式：读出姿势蓝图 → 生图时让新模特穿新衣服、站到同一位置 + 同样姿势，背景保留原样。
   */
  async analyzePersonInScene(sceneUrl: string, userApiKey?: string): Promise<string> {
    const instruction = [
      'You are a senior fashion photographer & art director. This image contains a PERSON inside a scene. We will REPLACE that person with a new model wearing different clothes, while keeping THE SAME COMPOSITION, camera angle, framing and position (this is a person-swap, not a re-shoot).',
      'Produce ONE compact English paragraph that will be used as a BLUEPRINT to redraw the shot. It MUST include:',
      '  1. FRAME & CAMERA: framing category (full body / 3-4 length / waist-up / half body), camera height (eye-level / low / high) and focal-length feel (wide / standard / short tele).',
      '  2. POSITION inside the frame: horizontal placement (left / center / right, with thirds if useful) and where the feet / hip line sit vertically.',
      '  3. HUMAN SCALE: approximate head height in percent of the frame height — be concrete (a single number like "head ≈ 12% of frame height"). Also note the head-top y% and feet/ground-contact y% from the top of the frame.',
      '  4. POSE: detailed body pose — body orientation (front / 3-4 / profile), weight leg, arm and hand positions, head tilt, gaze direction.',
      '  5. LIGHT ON PERSON: direction of the key light, which side is highlighted vs in shadow, shadow softness, and the direction and softness of the ground-contact shadow.',
      '  6. BACKGROUND: short description of the scene (location, surfaces, depth, atmosphere) so we know what to preserve after removing the original person.',
      'CRITICAL: DO NOT describe the original person\'s face, hair, skin tone, age, body shape, or clothing — those will be replaced. Describe ONLY framing + position + scale + pose + light + background.',
      'No disclaimers, no markdown, no lists — ONE paragraph only.',
    ].join(' ')
    return this.analyzeImage(sceneUrl, instruction, userApiKey)
  }

  /**
   * 快速工作台一键合成：衣服（正+可选反面）+ 模特参考图 + 场景图 + 布局蓝图 → 最终图。
   */
  async generateQuickWorkspaceImage(
    taskId: string,
    input: {
      mode: 'background' | 'fusion'
      clothingUrl: string
      clothingBackUrl?: string
      modelImageUrl: string
      sceneImageUrl: string
      placementBlueprint: string
      extraPrompt?: string
      aspectRatio?: '3:4' | '1:1' | '4:3' | '16:9' | '9:16'
      framing?: 'auto' | 'half' | 'full'
      device?: string
    },
    userApiKey?: string
  ): Promise<string> {
    const { mode, clothingUrl, clothingBackUrl, modelImageUrl, sceneImageUrl, placementBlueprint, extraPrompt } = input
    const aspectRatio = input.aspectRatio || '3:4'
    const framing = input.framing || 'auto'
    const devicePreset = getDevicePreset(input.device)
    const deviceBlock = devicePreset.promptFragment
      ? [
          '',
          '【拍摄器材与出片风格（严格遵守，这决定了最终照片是真实相机/手机拍出来的感觉）】',
          devicePreset.promptFragment,
          '注意：器材定义的焦距会影响"模特与镜头距离"和"画面中身体占比"；光圈决定"背景虚化程度"；成像风格决定"色彩/颗粒/锐度/HDR 强度"。以上三者必须在最终图中表现出来，禁止输出其他器材的成像感。',
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
      ? '构图要求：全身照——模特从头到脚完整入画，头顶以上和脚以下各留一点空气，不得裁切身体任一部位。'
      : framing === 'half'
      ? '构图要求：半身照——以腰部或胸部以上入画，双手至少一只可见；画面不得露出脚部。'
      : '构图要求：根据场景氛围自动选择最合适的取景。'

    const universalAntiFakeFace = this.getUniversalAntiFakeFaceClause()

    const userPrompt = mode === 'background'
      ? [
          '你是专业的虚拟试衣助手。用户会提供多张图片和一段姿势描述。',
          '',
          '你的任务：根据用户提供的姿势描述，将衣服穿到对应姿势的人物身上。',
          '',
          `【输出图片比例】${aspectHint}。不要输出其他比例，不要额外填黑边或拉伸。`,
          `【${framingHintZh}】`,
          deviceBlock,
          '',
          '【图片顺序与角色】',
          '  - 图[1] 模特参考图：仅用作模特的脸型、五官、发色发型、肤色等身份特征，严禁复制该图的身体比例、姿势、构图、相机角度、光照和背景。',
          '  - 图[2] 衣服正面：模特必须穿着这件衣服，颜色、面料、纹理、图案、版型、细节都要与原图完全一致。',
          clothingBackUrl ? '  - 图[3] 衣服反面：用于补全衣服背面的细节。' : '',
          `  - 图[${clothingBackUrl ? 4 : 3}] 场景图：作为最终拍摄地点参考（建筑、材质、空间氛围、主光方向等）。允许重新取景/调整相机角度，但必须看得出是"同一个地方"，至少保留 2 个该场景中可辨识的元素。`,
          '',
          '【姿势与位置描述（请严格按照此描述渲染人物姿态和在画面中的位置）】',
          placementBlueprint,
          extraPrompt ? `\n【用户补充要求】${extraPrompt}` : '',
          '',
          '【关于下装和鞋子的重要要求】',
          '- 如果用户只提供了上衣（如T恤、衬衫、外套等），你必须为模特搭配合适的下装（裤子/裙子/短裤等）和鞋子。',
          '- 下装风格必须与上衣协调（如休闲上衣配休闲裤/牛仔裤，正式衬衫配西裤等）。',
          '- 鞋子也要搭配完整（运动鞋、皮鞋、凉鞋等，根据整体风格决定）。',
          '- 绝对不允许生成没穿裤子或没穿鞋子的模特。',
          '- 根据模特可见的身体部分推断合适的下装和鞋子。',
          '',
          '【其他要求】',
          '- 必须严格按照上方"姿势与位置描述"生成人物姿态与在画面中的站位。',
          '- 衣服细节必须和用户提供的完全一致。',
          '- 优先使用模特参考图的脸部与身体特征（身份锁定），不要复制模特参考图的构图。',
          '- 背景可以根据需要适当调整取景，但必须明显是场景图中的同一地点。',
          '- 保持提示词中描述的角度、姿势、动态感。',
          '',
          '【人体比例硬约束（避免比例错误或悬浮）】',
          '- 按真实成人比例渲染（约 7.5 头身，身高约 1.7m），双脚踏实地面，地面接触阴影要自然。',
          '- 透视与地平线必须与场景一致；禁止巨人感、娃娃头、悬空。',
          '- 画面中人物占比要与姿势描述中的取景（全身/三分之二身/半身）匹配。',
          '',
          '【配饰锁定】',
          '- 除非衣服原图里本来就有，不要新增任何手袋、首饰、手表、墨镜、帽子、腰带、围巾、手套等配饰，手里不要拿东西。',
          '',
          '请直接生成最终图片（base64，无需 markdown 或解释）。',
        ].filter(Boolean).join('\n')
      : [
          '你是专业的虚拟试衣助手。用户会提供多张图片：',
          '  - 图[1] 模特参考图：用于提取模特的脸部特征（脸型、五官轮廓、肤色）。',
          '  - 图[2] 衣服正面' + (clothingBackUrl ? '；图[3] 衣服反面' : '') + '。',
          `  - 图[${clothingBackUrl ? 4 : 3}] 参考图（含原模特与场景）：提供基础姿态、构图、场景氛围。`,
          '',
          `【输出图片比例】${aspectHint}。`,
          `【${framingHintZh}】`,
          deviceBlock,
          '',
          '你的任务：生成"把用户的衣服、并结合模特参考图的脸部特征，穿到参考模特身上，并把参考模特的特征替换成上传模特的特征"的图片。要求：',
          '- 衣服细节必须和用户提供的完全一致（颜色、款式、图案、材质、纹理、剪裁）——这是最重要的。',
          '- 下装（裤子/裙子等）可以做轻微调整（版型微调、长度微调、褶皱纹理变化），风格保持协调；如果参考图里原本没穿鞋或没穿裤，必须补全合适的下装和鞋子。',
          '- 模特发型必须改变（换一种不同的发型和发色），脸型微调，以避免侵权；但模特年龄必须控制在 30 岁以下，保持年轻感。',
          '- 配饰要有变化（首饰、包包、帽子、鞋子等与原图不同）。',
          '- 场景背景要有较明显调整（更换光影角度、调整色调饱和度、微调景深虚化）。若参考图是具体场景，场景中的物品要有多处变化：室内场景更换家具、摆件、窗帘、地毯、花瓶等；户外场景更换植被种类、调整树木花草位置、更换或移除长椅/路灯/围栏等地景元素，添加或移除天空中的云彩。若参考图是纯色背景（白底、灰底等棚拍纯色），则不要新增任何物品，只调整光影和色调。整体仍保持在同一类型场景中，不要换成完全不相关的场景。',
          '- 保持模特的姿态和构图基本不变。',
          '- 参考图中的所有文字、水印、logo 必须全部过滤掉，生成结果中不要出现任何文字。',
          '',
          '【原模特姿态与构图参考（供保持姿态一致使用）】',
          placementBlueprint,
          extraPrompt ? `\n【用户补充要求】${extraPrompt}` : '',
          '',
          '【人体比例硬约束】按真实成人比例渲染（约 7.5 头身），双脚踏实地面；透视与地平线与参考图一致；禁止巨人感、娃娃头、悬空。',
          '',
          '请直接生成换装后的图片（base64，无需 markdown 或解释）。',
        ].filter(Boolean).join('\n')

    const imageUserPrompt = appendNanoBananaRealismHint(`${userPrompt}\n\n${universalAntiFakeFace}`, getActiveAiModel())
    const content: ChatMessageContentPart[] = [{ type: 'text', text: imageUserPrompt }]

    content.push({
      type: 'image_url',
      image_url: { url: await this.toDataUrl(modelImageUrl), detail: config.aiImageDetail },
    })
    content.push({
      type: 'image_url',
      image_url: { url: await this.toDataUrl(clothingUrl), detail: config.aiImageDetail },
    })
    if (clothingBackUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: await this.toDataUrl(clothingBackUrl), detail: config.aiImageDetail },
      })
    }
    content.push({
      type: 'image_url',
      image_url: { url: await this.toDataUrl(sceneImageUrl), detail: config.aiImageDetail },
    })

    const systemPrompt = mode === 'background'
      ? '你是专业的虚拟试衣助手，也是顶级时尚摄影师。严格按照用户给出的"姿势与位置描述"把指定模特（仅用其脸、发型、肤色）穿着指定衣服放入场景地点中。可以重新取景与调整机位，但必须保留场景地点的标志性元素（至少 2 处可辨识元素），让观众看得出是同一个地方。模特必须按真实成人比例（约 7.5 头身）渲染，双脚着地，透视与地平线与场景一致，禁止巨人、娃娃头或悬空。严格还原衣服的颜色、面料、纹理、图案、版型；模特参考图仅用于面部身份，禁止复制其身体比例、姿势、构图、相机角度、光照或背景。如果衣服仅是上衣，必须搭配协调的下装和鞋子，严禁生成没穿裤子或没穿鞋子的模特。光照、色温、阴影方向与场景一致。输出像真实相机拍摄的街拍质感：自然皮肤纹理、毛孔与细微不对称；禁止 CGI、塑料皮肤、美颜抹平、HDR 过亮、插画感、扭曲的手或多出的肢体。直接返回最终图片的 base64，不要 markdown、不要解释。'
      : '你是专业的虚拟试衣助手。本次任务是"换装合成"：使用模特参考图的脸部特征（脸型、五官、肤色）作为新模特的脸，但发型和发色必须换成与原参考图不同的样式；模特年龄控制在 30 岁以下并保持年轻感；脸型可做轻微调整以避免侵权。衣服必须和用户提供的完全一致（颜色、款式、图案、材质、纹理、剪裁），这是最重要的；下装可做轻微版型/长度/褶皱调整；未覆盖部分必须补全合适的下装和鞋子，严禁没穿裤子或没穿鞋子。配饰（首饰、包、帽子、鞋等）需要与参考图不同。姿态与构图基本保持；背景要有明显调整：若参考图是具体场景则替换家具/摆件/植被/云彩等物品并调整光影色调，若参考图是纯色棚拍背景则只调整光影色调、不新增物品；整体仍属于同一类型场景。必须过滤掉参考图中的所有文字、水印、logo，生成图中不得出现任何文字。模特需按真实成人比例（约 7.5 头身）渲染，双脚着地，透视与地平线与参考图一致，禁止巨人、娃娃头或悬空。输出像真实相机拍摄的街拍质感：自然皮肤纹理、毛孔与细微不对称；禁止 CGI、塑料皮肤、美颜抹平、HDR 过亮、插画感、扭曲的手或多出的肢体。直接返回最终图片的 base64，不要 markdown、不要解释。'

    const genPayload: Record<string, unknown> = {
      model: getActiveAiModel(),
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
      'Controlled studio lighting: balanced key + gentle fill + subtle rim, face clearly visible while preserving highlight detail, no blown highlights, no harsh shadows.',
      'Neutral light grey studio backdrop. Shot on Hasselblad X2D 90mm, natural skin texture with visible pores, soft natural highlights, realistic color rendition.',
      'IMPORTANT: This image will be used as a MODEL REFERENCE for compositing into a scene. The face must be clear and well-lit, AND the body posture should be natural and relaxed (standing, not sitting). The clothing should be simple and neutral.',
      'Return only the final image as base64.',
    ].filter(Boolean).join(' ')

    const response = await this.requestChatCompletion({
      model: getActiveAiModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You are an expert portrait generation model. Generate a clear, well-lit, natural standing portrait for use as a model reference. The face must be clearly visible and photorealistic, with a relaxed natural body posture (not stiff front-facing). The subject should wear simple neutral clothing. Return only the generated image in base64 without markdown or explanation.',
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
    opts?: { count?: number; referenceUrl?: string }
  ): Promise<string[]> {
    const categoryStyle = getModelCategoryStyleParagraph(modelConfig.category)
    const corePhysical = buildModelCorePhysical(modelConfig)
    const poseExpr = appendPoseAndExpression(modelConfig)
    const generateCount = Math.min(Math.max(opts?.count ?? 1, 1), 4)

    const modelDescription = `Casting direction: ${categoryStyle} Subject details: ${corePhysical}${poseExpr}`.trim()

    const prompt = [
      `Generate ${generateCount} photorealistic half-body portrait(s) (waist up) of a NEW model, 3:4 portrait aspect ratio, vertical composition.`,
      `Model specification:\n${modelDescription}`,
      opts?.referenceUrl
        ? 'A reference photo is attached. The generated model should closely match the FACE in the reference — same facial bone structure, eye shape, nose, lips, jawline, hair style/color. Adapt the body and styling as specified above.'
        : 'Create a completely unique, natural-looking person. The face should be highly detailed and photorealistic — NOT a generic stock photo face.',
      'IMPORTANT GUIDELINES:',
      '- Front-facing pose (face fully visible), confident natural expression unless otherwise specified',
      '- Controlled studio lighting: balanced key + gentle fill + subtle rim, face clearly visible',
      '- Neutral light grey studio backdrop, clean and simple',
      '- Shot on Hasselblad X2D 90mm, natural skin texture with visible pores, shallow depth of field',
      '- The model should wear simple, minimal clothing (plain white t-shirt or simple neutral top) — clothing is NOT the focus, the MODEL is',
      '- Each portrait should show the SAME person but from a slightly different angle or with a slightly different expression (if generating multiple)',
      'Avoid: side profile, illustration, over-sharpened, waxy skin, dark shadows, AI artifacts, excessive retouching.',
      'Return only the final image(s) as base64.',
    ].join('\n\n')

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
      model: getActiveAiModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: [
            'You are an expert portrait generation model for fashion e-commerce.',
            'Your job: generate a photorealistic model portrait based on the detailed specification provided.',
            'The result must be: front-facing, bright studio lighting, photorealistic half-body portrait, 3:4 portrait aspect ratio.',
            'The model should wear SIMPLE MINIMAL clothing (plain t-shirt) — the focus is on the model\'s face and body, not clothing.',
            'Generate highly detailed, natural-looking faces with realistic skin texture, unique facial features, and natural asymmetry.',
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

  // 6b. 模特融合 - 将多张模特面部特征融合生成新模特
  async fuseModelFaces(
    taskId: string,
    modelUrls: string[],
    userApiKey?: string,
    opts?: { weights?: number[]; strategy?: 'balanced' | 'feature-pick' | 'dominant' }
  ): Promise<string> {
    const strategy = opts?.strategy ?? 'balanced'

    // Step 1: 逐张分析面部特征（结构化，按属性拆解）
    const structuredFeatures: { label: string; features: string; clothing: string }[] = []
    const labels = ['A', 'B', 'C']
    for (let i = 0; i < modelUrls.length; i++) {
      const desc = await this.analyzeImage(
        modelUrls[i],
        `Analyze this person's face and clothing SEPARATELY. Return EXACTLY 2 lines:
FACE|face shape, eye shape+color, eyebrow shape, nose shape, lip shape+fullness, jawline, cheekbone, skin tone (Fitzpatrick level), hair style+color+length
CLOTHING|garment type, color, fabric, pattern, neckline, sleeves, accessories

Example:
FACE|oval face, double-lid almond eyes dark brown, straight medium eyebrows, straight narrow nose, full natural lips, soft jawline, moderate cheekbones, Fitzpatrick III warm beige, straight black hair shoulder-length
CLOTHING|fitted black ribbed knit turtleneck, matte texture, long sleeves, no accessories`,
        userApiKey
      )
      const faceLine = desc.split('\n').find(l => l.startsWith('FACE|'))
      const clothLine = desc.split('\n').find(l => l.startsWith('CLOTHING|'))
      structuredFeatures.push({
        label: labels[i],
        features: faceLine?.replace('FACE|', '').trim() || desc,
        clothing: clothLine?.replace('CLOTHING|', '').trim() || '',
      })
    }

    // Step 2: 构建权重描述
    const rawWeights = opts?.weights ?? modelUrls.map(() => 1)
    const totalWeight = rawWeights.reduce((a, b) => a + b, 0)
    const normalizedWeights = rawWeights.map(w => Math.round((w / totalWeight) * 100))
    const weightDesc = structuredFeatures.map((f, i) =>
      `Person ${f.label} (weight ${normalizedWeights[i]}%): ${f.features}`
    ).join('\n')

    // Step 3: 根据策略构建融合指令
    let fusionInstruction: string
    if (modelUrls.length === 1) {
      fusionInstruction = `Recreate this person faithfully: ${structuredFeatures[0].features}. Preserve their exact appearance.`
    } else if (strategy === 'feature-pick') {
      fusionInstruction = [
        `Create a NEW face by picking the most attractive individual feature from each person:`,
        weightDesc,
        `For EACH facial feature (eyes, nose, lips, jawline, skin tone, hair), select the best version from whichever person has it, weighted by the percentages above.`,
        `The final face should be a coherent, natural-looking combination — not a copy of any single person.`,
      ].join('\n')
    } else if (strategy === 'dominant') {
      const dominantIdx = normalizedWeights.indexOf(Math.max(...normalizedWeights))
      fusionInstruction = [
        `Create a face PRIMARILY based on Person ${structuredFeatures[dominantIdx].label} (${normalizedWeights[dominantIdx]}% weight):`,
        `${structuredFeatures[dominantIdx].features}`,
        `Then subtly incorporate features from the other person(s):`,
        ...structuredFeatures.filter((_, i) => i !== dominantIdx).map((f, i) =>
          `Person ${f.label} (${normalizedWeights[structuredFeatures.indexOf(f)]}%): ${f.features}`
        ),
      ].join('\n')
    } else {
      fusionInstruction = [
        `Create a NEW face by blending ALL ${modelUrls.length} faces with EQUAL influence. No single person should dominate.`,
        `Each person's contribution:`,
        weightDesc,
        `CRITICAL BLENDING RULES:`,
        `- Skin tone: average the tones (e.g., if one is fair and one is medium, result should be light-medium)`,
        `- Eye shape: blend the shapes proportionally by weight`,
        `- Nose, lips, jawline: create an intermediate form weighted by the percentages above`,
        `- Hair: if significantly different, lean toward the higher-weighted person but incorporate elements from others`,
        `- The result must look like a GENUINELY NEW person, not recognizably any single input`,
      ].join('\n')
    }

    // Step 4: 服装指令 — 从权重最高的人继承
    const clothingSourceIdx = normalizedWeights.indexOf(Math.max(...normalizedWeights))
    const clothingDesc = structuredFeatures[clothingSourceIdx].clothing
    const clothingInstruction = clothingDesc
      ? `The person MUST wear: ${clothingDesc}. Preserve every detail — fabric, color, pattern, neckline, sleeves, accessories. Do NOT substitute with a generic white t-shirt or plain shirt.`
      : `The person MUST wear the EXACT same clothing shown in reference photo ${structuredFeatures[clothingSourceIdx].label}. Do NOT substitute with a generic white t-shirt.`

    const prompt = [
      'Generate a photorealistic half-body portrait (waist up) of a new model, 3:4 portrait aspect ratio, vertical composition.',
      fusionInstruction,
      clothingInstruction,
      'FRONT-FACING pose only — face fully visible from the front, no side profile or 3/4 angle. Confident natural expression.',
      'Controlled studio lighting: balanced key + gentle fill + subtle rim, face clearly visible while preserving highlight detail.',
      'Neutral studio backdrop. Shot on Hasselblad X2D 90mm, natural skin texture, shallow depth of field.',
      'Avoid: side profile, illustration, over-sharpened, waxy skin, dark shadows, AI artifacts.',
      'Return only the final image as base64.',
    ].join('\n\n')

    // Step 5: 随机打乱图片顺序以消除位置偏差
    const indices = modelUrls.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]]
    }

    const content: ChatMessageContentPart[] = [{ type: 'text', text: prompt }]
    for (const idx of indices) {
      content.push({
        type: 'text',
        text: `[Reference Photo ${structuredFeatures[idx].label} — weight ${normalizedWeights[idx]}%]`,
      })
      content.push({
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(modelUrls[idx]),
          detail: config.aiImageDetail,
        },
      })
    }

    const response = await this.requestChatCompletion({
      model: getActiveAiModel(),
      stream: false,
      messages: [
        {
          role: 'system',
          content: [
            'You are an expert portrait generation model specializing in face blending.',
            'Your job: create a GENUINELY NEW person by merging facial features from multiple reference photos.',
            'CRITICAL RULES:',
            '1. EQUAL BLENDING — Each reference photo contributes proportionally to its stated weight percentage. Do NOT let any single photo dominate unless weights explicitly differ.',
            '2. FEATURE-LEVEL MIXING — Blend at the individual feature level (eyes from multiple sources, nose shape averaged, etc.), not just pick one face and slightly adjust.',
            '3. CLOTHING PRESERVATION — The generated person MUST wear the exact clothing described. Do NOT replace with a white t-shirt or generic outfit.',
            '4. POSITION INDEPENDENCE — The order of reference photos does NOT indicate priority. Only the stated weight percentages matter.',
            '5. Output: front-facing, bright studio lighting, photorealistic half-body portrait, 3:4 portrait aspect ratio.',
            'Return only the generated image in base64 without markdown or explanation.',
          ].join('\n'),
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
        'Maintain premium editorial quality with natural textile rendering.',
        'Return only the final image as base64 data without markdown.',
      ].filter(Boolean).join(' ')

      const content: ChatMessageContentPart[] = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ]

      const response = await this.requestChatCompletion({
        model: getActiveAiModel(),
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are an expert fashion image recoloring model. You receive a garment image and must regenerate it with a new color while preserving 100% of the material texture, fabric details, highlights, shadows, and garment structure. Only the color/hue changes. Return only the generated image in base64 without markdown or explanation.',
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
        'Premium editorial quality with realistic textile and hardware rendering.',
        'Return only the final image as base64 data without markdown.',
      ].filter(Boolean).join(' ')

      const content: ChatMessageContentPart[] = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ]

      const response = await this.requestChatCompletion({
        model: getActiveAiModel(),
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are an expert fashion detail enhancement model. You receive a garment image and must add a specific craft/design element while keeping the original silhouette 100% identical. The added element must look naturally integrated with the garment. Return only the generated image in base64 without markdown or explanation.',
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
          `Render as a clean premium product photo on a neutral studio background, flat-lay or ghost-mannequin style consistent with the reference, with natural textile rendering that makes the locked material instantly recognizable.`,
          'Return only the final image as base64 data without markdown.',
        ].filter(Boolean).join(' ')

        const content: ChatMessageContentPart[] = [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
        ]

        const response = await this.requestChatCompletion({
          model: getActiveAiModel(),
          stream: false,
          messages: [
            {
              role: 'system',
              content: `You are a senior pattern-maker and fashion redesign model. Your ONE job: re-draft the paper pattern of a garment using the EXACT SAME bolt of fabric. The fiber, weight, weave, color, sheen, and drape of the output MUST be pixel-level identical to the reference. You only change cut/construction topology (length, collar, sleeves, closure, fit, hem). You never change the material, never change the garment category, never add random decorative details. Output a clean premium product image. Return only the generated image in base64 without markdown or explanation.`,
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
        `CRITICAL RULES: (1) The new garment must be ORIGINAL — AI can change the structure, silhouette, and garment type freely; (2) It must align with Western/European mass-market fashion aesthetics; (3) Maintain premium editorial quality with realistic textile rendering; (4) The result should look like a real product photo, not a sketch or illustration.${userModifier}`,
        constraintHint ? `USER DESIGN CONSTRAINTS: ${opts.constraints}` : '',
        'Return only the final image as base64 data without markdown.',
      ].filter(Boolean).join(' ')

      const content: ChatMessageContentPart[] = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ]

      const response = await this.requestChatCompletion({
        model: getActiveAiModel(),
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are an expert fashion trend generation model with full creative freedom. You receive a reference garment and a trend direction. Create a completely new garment that embodies the specified trend. You may change the garment structure, silhouette, and design freely. The result must look like a premium fashion product photo. Return only the generated image in base64 without markdown or explanation.',
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
        content: 'You are an image upscaling model. Keep composition identical. Keep exact original aspect ratio. Return only the upscaled image as base64 without any text or explanation.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Upscale this image to about 2x resolution (${targetDesc}). Keep EXACT same aspect ratio, framing, colors and details. Do not crop, pad, or recompose.`,
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
        model: getActiveAiModel(),
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

  // ============ 私有方法 ============

  private async analyzeImage(imageUrl: string, instruction: string, userApiKey?: string): Promise<string> {
    const response = await this.requestChatCompletion({
      model: getActiveAiModel(),
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
