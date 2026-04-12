import fs from 'fs/promises'
import path from 'path'
import { config, getUploadPath } from './config'
import { db } from './db'
import type { ModelConfig, SceneConfig } from './types'
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
        mime_type?: string
        media_type?: string
      }>
    }
  }>
  data?: Array<{
    b64_json?: string
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
      model: config.aiModel,
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
    const imageUserPrompt = appendNanoBananaRealismHint(`${prompt}\n\n${universalAntiFakeFace}`, config.aiModel)
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

    const genPayload: Record<string, unknown> = {
      model: config.aiModel,
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

    const image = this.extractImagePayload(response)
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
      model: config.aiModel,
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

    const image = this.extractImagePayload(response)
    const extension = extensionByMime[image.mimeType] || '.png'
    const fileName = `${taskId}_face_ref${extension}`
    const filePath = path.join(getUploadPath(), 'results', fileName)

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
    return toStoredFilePath(`uploads/results/${fileName}`)
  }

  // 6. 模特融合 - 将多张模特面部特征融合生成新模特
  async fuseModelFaces(taskId: string, modelUrls: string[], userApiKey?: string): Promise<string> {
    // Step 1: 分析每张模特图的面部特征和服装
    const faceDescriptions: string[] = []
    const clothingDescriptions: string[] = []
    for (const url of modelUrls) {
      const desc = await this.analyzeImage(
        url,
        'Describe the facial features AND clothing of this person in precise English. Include: (1) Face: face shape, eye shape and color, eyebrow shape, nose shape, lip shape and fullness, jawline, cheekbone structure, skin tone, hair style and color. (2) Clothing: garment type, color, fabric, pattern, neckline, sleeves, and any visible accessories. Return one detailed sentence for face and one for clothing.',
        userApiKey
      )
      faceDescriptions.push(desc)
      clothingDescriptions.push(desc)
    }

    // Step 2: 构建融合 prompt
    const fusionInstruction = modelUrls.length === 1
      ? `Create a portrait based on this person: ${faceDescriptions[0]}. The person must wear the SAME clothing shown in the reference photo — do NOT change it to a generic white t-shirt or any default outfit.`
      : `Create a NEW face by blending these ${modelUrls.length} faces: ${faceDescriptions.map((d, i) => `Face ${i + 1}: ${d}`).join('; ')}. The result should combine the best facial features from each. The person must wear the SAME clothing shown in the FIRST reference photo — do NOT change it to a generic white t-shirt or any default outfit.`

    const prompt = [
      'Generate a photorealistic half-body portrait (waist up) of a new model, 3:4 portrait aspect ratio, vertical composition.',
      fusionInstruction,
      'IMPORTANT: The person MUST wear the EXACT same clothing as shown in the reference photo(s). Do NOT change, simplify, or replace the clothing with a generic white t-shirt or plain shirt. Preserve every detail of the original outfit — fabric, color, pattern, neckline, sleeves, accessories.',
      'FRONT-FACING pose only — face fully visible from the front, no side profile or 3/4 angle. Confident natural expression.',
      'Controlled studio lighting: balanced key + gentle fill + subtle rim, face clearly visible while preserving highlight detail, no blown highlights, no harsh shadows.',
      'Neutral studio backdrop. Shot on Hasselblad X2D 90mm, natural skin texture, shallow depth of field.',
      'Avoid: side profile, illustration, over-sharpened, waxy skin, dark shadows, AI artifacts, generic/default clothing, white t-shirt substitution.',
      'Return only the final image as base64.',
    ].join(' ')

    // Step 3: 发送所有模特图 + prompt 给 AI
    const content: ChatMessageContentPart[] = [{ type: 'text', text: prompt }]

    for (const url of modelUrls) {
      content.push({
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(url),
          detail: config.aiImageDetail,
        },
      })
    }

    const response = await this.requestChatCompletion({
      model: config.aiModel,
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You are an expert portrait generation model. Create a NEW person by blending facial features from the provided reference photos. CRITICAL: The generated person MUST wear the exact same clothing shown in the reference photo — do NOT replace it with a white t-shirt, plain shirt, or any default/generic outfit. Preserve the original clothing faithfully. The result must be: front-facing (no side profile), bright studio lighting, photorealistic half-body portrait, 3:4 portrait aspect ratio. Return only the generated image in base64 without markdown or explanation.',
        },
        {
          role: 'user',
          content,
        },
      ],
    }, userApiKey)

    const image = this.extractImagePayload(response)
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
  async luxuryColorTransform(taskId: string, imageUrl: string, userApiKey?: string, excludedItems: string[] = []): Promise<{ resultUrls: string[]; generatedItems: string[] }> {
    // Step 1: 色彩脑暴
    const excludeHint = excludedItems.length > 0 ? ` IMPORTANT: Do NOT propose any of these already-generated colors: ${excludedItems.join(', ')}. You must propose completely different colors.` : ''
    const brainstorm = await this.analyzeImage(
      imageUrl,
      `You are a luxury fashion color consultant. Analyze this garment's material, reflectivity, and current color. AVOID the original hue entirely. Propose exactly 3 premium luxury color alternatives that would look stunning on this material. Consider: (1) Material's interaction with light (matte absorbs, silk reflects, etc.); (2) Color trends in European luxury fashion; (3) Visual contrast between the 3 colors (they must be distinctly different). Format: Return EXACTLY 3 colors, one per line, in this format: Color Name|hex code. Example: Royal Burgundy|#4A0E2E\nFrosted Mint|#98FF98\nMidnight Navy|#1B1F3B${excludeHint}`,
      userApiKey
    )

    const colorLines = brainstorm.split('\n').map(l => l.trim()).filter(l => l.includes('|'))
    if (colorLines.length === 0) {
      // fallback
      colorLines.push('Royal Burgundy|#4A0E2E', 'Frosted Mint|#98FF98', 'Midnight Navy|#1B1F3B')
    }
    const colors = colorLines.slice(0, 3).map(line => {
      const [name, hex] = line.split('|').map(s => s.trim())
      return { name, hex: hex || '#000000' }
    })

    // Step 2: 并行生成 3 张变色图
    const results: string[] = []
    for (let i = 0; i < colors.length; i++) {
      const color = colors[i]
      const prompt = [
        `Generate a photorealistic fashion image of the SAME garment shown in the reference image, but change ONLY the color/hue to "${color.name}" (${color.hex}).`,
        `CRITICAL CONSTRAINTS: (1) 100% PRESERVE all fiber textures, weave patterns, stitch details, and surface characteristics of the original material; (2) 100% PRESERVE all highlights, shadows, and depth — only shift the hue and saturation; (3) 100% PRESERVE the garment silhouette, fit, drape, and all structural details; (4) The new color "${color.name}" must look natural on this specific fabric type with realistic color absorption/reflection properties; (5) Background and model (if any) remain identical.`,
        'Maintain premium editorial quality with natural textile rendering.',
        'Return only the final image as base64 data without markdown.',
      ].join(' ')

      const content: ChatMessageContentPart[] = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ]

      const response = await this.requestChatCompletion({
        model: config.aiModel,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are an expert fashion image recoloring model. You receive a garment image and must regenerate it with a new color while preserving 100% of the material texture, fabric details, highlights, shadows, and garment structure. Only the color/hue changes. Return only the generated image in base64 without markdown or explanation.',
          },
          { role: 'user', content },
        ],
      }, userApiKey)

      const image = this.extractImagePayload(response)
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
  async materialAwareElementAdd(taskId: string, imageUrl: string, userApiKey?: string, excludedItems: string[] = []): Promise<{ resultUrls: string[]; generatedItems: string[] }> {
    // Step 1: 材质识别
    const materialDesc = await this.recognizeMaterial(imageUrl, userApiKey)

    // Step 2: 基于材质推导 3 种兼容工艺
    const excludeHint = excludedItems.length > 0 ? ` IMPORTANT: Do NOT propose any of these already-generated elements: ${excludedItems.join(', ')}. You must propose completely different elements.` : ''
    const elementBrainstorm = await this.analyzeImage(
      imageUrl,
      `Based on the garment material (${materialDesc}), propose exactly 3 compatible craft/detail elements that could be added WITHOUT changing the basic silhouette. Each element must be: (1) Compatible with the identified fabric type; (2) Commonly used in luxury fashion; (3) Visually distinct from each other. Format: Return EXACTLY 3 elements, one per line, concise name only. Examples: YKK metal zipper, Contrast topstitching, Embroidered monogram${excludeHint}`,
      userApiKey
    )

    const elements = elementBrainstorm.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3)
    if (elements.length === 0) {
      elements.push('Metal zipper detail', 'Contrast topstitching', 'Embroidered patch')
    }

    // Step 3: 生成 3 张加元素图
    const results: string[] = []
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]
      const prompt = [
        `Generate a photorealistic fashion image of the SAME garment shown in the reference image, but ADD this craft/detail element: "${element}".`,
        `CRITICAL CONSTRAINTS: (1) The garment silhouette (outline, shape, fit) must remain 100% IDENTICAL to the original; (2) The original fabric, color, and base design must remain intact; (3) ONLY add the specified element "${element}" as an additional detail; (4) The added element must look naturally integrated — matching the garment's style, fabric, and quality level; (5) Maintain all original stitching, seams, and construction details.`,
        'Premium editorial quality with realistic textile and hardware rendering.',
        'Return only the final image as base64 data without markdown.',
      ].join(' ')

      const content: ChatMessageContentPart[] = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ]

      const response = await this.requestChatCompletion({
        model: config.aiModel,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are an expert fashion detail enhancement model. You receive a garment image and must add a specific craft/design element while keeping the original silhouette 100% identical. The added element must look naturally integrated with the garment. Return only the generated image in base64 without markdown or explanation.',
          },
          { role: 'user', content },
        ],
      }, userApiKey)

      const image = this.extractImagePayload(response)
      const extension = extensionByMime[image.mimeType] || '.png'
      const fileName = `${taskId}_element_${i + 1}${extension}`
      const filePath = path.join(getUploadPath(), 'results', fileName)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
      results.push(toStoredFilePath(`uploads/results/${fileName}`))
    }

    return { resultUrls: results, generatedItems: elements }
  }

  // 材质锁定改款式（品类感知版：AI识别材质+款式，同品类内改款，符合欧美趋势）
  async materialLockedSilhouetteChange(taskId: string, imageUrl: string, userApiKey?: string, excludedItems: string[] = []): Promise<{ resultUrls: string[]; generatedItems: string[] }> {
    // Step 1: 结构化识别 — 材质 DNA + 品类 + 款式
    const { materialDna, category, silhouette } = await this.recognizeGarmentStructure(imageUrl, userApiKey)

    // Step 2: 注入品类规范
    const categoryRules = this.getCategoryRules(category)
    const categoryLabel = this.getCategoryLabel(category)

    // Step 3: AI 基于原款式 + 材质 + 欧美趋势推导 3 种同品类改款方向
    const excludeHint = excludedItems.length > 0
      ? ` IMPORTANT: Do NOT propose any of these already-generated directions: ${excludedItems.join('; ')}. You must propose completely different redesign directions.`
      : ''
    const directionBrainstorm = await this.analyzeImage(
      imageUrl,
      `You are a fashion design director for European and American markets. The original garment is a ${categoryLabel} with these details: "${silhouette}". Material DNA: "${materialDna}".

Propose EXACTLY 3 redesign directions that:
(1) Stay within the SAME garment category (${categoryLabel}) — do NOT change to a different category;
(2) Align with current European/American fashion trends (e.g., quiet luxury, minimalist refinement, deconstructed details, oversized proportions, Y2K revival, utility influence);
(3) Preserve the original material DNA — fabric, color, texture must remain the same;
(4) Are distinctly different from each other and from the original design.

Each direction should modify within the category's design vocabulary (neckline, sleeve, silhouette proportions, construction details, etc.).

Format: Return EXACTLY 3 directions, one per line, with a brief name and description.
Example: Minimalist Midi — Clean bateau neckline, sleeveless, fluid A-line silhouette, knee-length
Relaxed Wrap — Soft wrap front, 3/4 bishop sleeves, midi length with side slit
Structured A-Line — Boat neck, cap sleeves, defined waist, full A-line midi skirt${excludeHint}`,
      userApiKey
    )

    const directions = directionBrainstorm.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3)
    if (directions.length === 0) {
      directions.push(
        `Minimalist ${categoryLabel} — Clean lines, refined silhouette`,
        `Relaxed ${categoryLabel} — Soft proportions, modern ease`,
        `Structured ${categoryLabel} — Defined shape, bold details`,
      )
    }

    // Step 4: 生成 3 张改款图
    const results: string[] = []
    for (let i = 0; i < directions.length; i++) {
      const direction = directions[i]
      const prompt = [
        `Generate a photorealistic fashion image of a redesigned ${categoryLabel} based on the reference garment, following this design direction: "${direction}".`,
        `Original Material DNA: ${materialDna}`,
        `CATEGORY RULES: ${categoryRules}`,
        `CRITICAL CONSTRAINTS: (1) The fabric, color, texture, weave pattern, and material properties MUST be 100% identical to the reference garment — this is MATERIAL-LOCKED redesign; (2) The new garment MUST remain in the "${categoryLabel}" category — same garment type, same category structure, only design details change; (3) The redesign must follow current European/American fashion aesthetics and trends; (4) The new design must be realistic, wearable, and look like a premium fashion product; (5) All surface details (sheen, texture, weight, drape) must match the reference material; (6) Maintain premium editorial quality with natural textile rendering.`,
        'Return only the final image as base64 data without markdown.',
      ].join(' ')

      const content: ChatMessageContentPart[] = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ]

      const response = await this.requestChatCompletion({
        model: config.aiModel,
        stream: false,
        messages: [
          {
            role: 'system',
            content: `You are an expert fashion redesign model specializing in same-category garment transformations. You receive a garment reference image and must create a NEW version within the SAME garment category, preserving 100% of the original fabric, color, texture, and material properties. You may change design details (neckline, sleeves, proportions, construction) but MUST stay within the original garment category. The design must align with European/American fashion trends. Return only the generated image in base64 without markdown or explanation.`,
          },
          { role: 'user', content },
        ],
      }, userApiKey)

      const image = this.extractImagePayload(response)
      const extension = extensionByMime[image.mimeType] || '.png'
      const fileName = `${taskId}_silhouette_${i + 1}${extension}`
      const filePath = path.join(getUploadPath(), 'results', fileName)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'))
      results.push(toStoredFilePath(`uploads/results/${fileName}`))
    }

    return { resultUrls: results, generatedItems: directions }
  }

  // 商业脑暴模式
  async commercialBrainstorm(taskId: string, imageUrl: string, customPrompt?: string, userApiKey?: string, excludedItems: string[] = []): Promise<{ resultUrls: string[]; generatedItems: string[] }> {
    const userModifier = customPrompt ? ` User creative direction: "${customPrompt}". This should be a CORE WEIGHT in the generation — the AI must prioritize this direction.` : ''

    // Step 1: 趋势推导
    const excludeHint = excludedItems.length > 0 ? ` IMPORTANT: Do NOT suggest any of these already-generated directions: ${excludedItems.join('; ')}. You must propose completely different trend directions.` : ''
    const trendPrompt = await this.analyzeImage(
      imageUrl,
      `You are a trend forecasting AI for European and American fashion markets. Based on this garment, suggest 3 distinctly different trend directions that would appeal to Western mass-market consumers. Consider current trends like: minimalism, workwear/utility, deconstruction, Y2K revival, quiet luxury, gorpcore. Each direction should represent a DIFFERENT aesthetic movement. Format: Return EXACTLY 3 directions, one per line, with a brief description. Example: Minimalist Elevation — Clean lines, muted palette, architectural silhouette${excludeHint}`,
      userApiKey
    )

    const directions = trendPrompt.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3)
    if (directions.length === 0) {
      directions.push('Minimalist Elevation', 'Utility Workwear', 'Deconstructed Avant-garde')
    }

    // Step 2: 每个方向生成 1 张 = 3 张
    const results: string[] = []
    for (let i = 0; i < directions.length; i++) {
      const direction = directions[i]
      const prompt = [
        `Generate a photorealistic fashion image of a completely NEW garment inspired by the reference image, following this trend direction: "${direction}".`,
        `CRITICAL RULES: (1) The new garment must be ORIGINAL — AI can change the structure, silhouette, and garment type freely; (2) It must align with Western/European mass-market fashion aesthetics; (3) Maintain premium editorial quality with realistic textile rendering; (4) The result should look like a real product photo, not a sketch or illustration.${userModifier}`,
        'Return only the final image as base64 data without markdown.',
      ].join(' ')

      const content: ChatMessageContentPart[] = [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: await this.toDataUrl(imageUrl), detail: config.aiImageDetail } },
      ]

      const response = await this.requestChatCompletion({
        model: config.aiModel,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are an expert fashion trend generation model with full creative freedom. You receive a reference garment and a trend direction. Create a completely new garment that embodies the specified trend. You may change the garment structure, silhouette, and design freely. The result must look like a premium fashion product photo. Return only the generated image in base64 without markdown or explanation.',
          },
          { role: 'user', content },
        ],
      }, userApiKey)

      const image = this.extractImagePayload(response)
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
        model: config.aiModel,
        stream: false,
        imageSize: '4k',
        messages: upscaleMessages,
      }, userApiKey)

      const image = this.extractImagePayload(response)
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
      model: config.aiModel,
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

  private extractImagePayload(response: ChatCompletionResponse): ImagePayload {
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

    throw new Error('AI 生图接口未返回 base64 图片数据')
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
