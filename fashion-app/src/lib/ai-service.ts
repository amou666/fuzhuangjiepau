import fs from 'fs/promises'
import path from 'path'
import { config, getUploadPath } from './config'
import type { ModelConfig, SceneConfig } from './types'

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

    const categoryStyle = modelConfig.category === 'supermodel'
      ? 'professional fashion supermodel with striking features, editorial look, high-fashion appeal'
      : modelConfig.category === 'kardashian'
      ? 'Kardashian-style glamorous beauty, curvaceous hourglass figure, full lips, contoured makeup, voluminous hair, confident sultry gaze, luxury aesthetic'
      : 'natural everyday girl next door, relatable and approachable, authentic beauty'

    const ethnicityStyle: Record<string, string> = {
      Chinese: 'Chinese',
      American: 'American',
      British: 'British',
      French: 'French',
      Korean: 'Korean',
      Japanese: 'Japanese',
      Indian: 'Indian',
    }
    const ethnicity = ethnicityStyle[modelConfig.ethnicity] || 'American'

    // 替换模式下只描述模特面部和体型，姿势由参考图决定
    if (isReplaceMode) {
      if (modelConfig.mode === 'upload' && modelConfig.imageUrl) {
        const facialDescription = await this.analyzeImage(
          modelConfig.imageUrl,
          'Describe ONLY the facial features (face shape, eyes, nose, mouth), hair style and color, skin tone, and body type. DO NOT describe pose, gesture, expression, or lighting. Return one sentence only.',
          userApiKey
        )
        return `${categoryStyle}, ${modelConfig.age} years old, ${ethnicity}, ${facialDescription}`
      }
      return `a ${categoryStyle}, ${modelConfig.age} years old, ${ethnicity} ${modelConfig.gender} with ${modelConfig.skinTone} skin tone, ${modelConfig.bodyType} body type`
    }

    if (modelConfig.mode === 'upload' && modelConfig.imageUrl) {
      const facialDescription = await this.analyzeImage(
        modelConfig.imageUrl,
        'Describe ONLY the facial features (face shape, eyes, nose, mouth), hair style and color, skin tone, and body type. DO NOT describe pose, gesture, expression, or lighting. Return one sentence only.',
        userApiKey
      )
      return `${categoryStyle}, ${modelConfig.age} years old, ${ethnicity}, ${facialDescription}, pose ${modelConfig.pose}, expression ${modelConfig.expression}`
    }

    return `a ${categoryStyle}, ${modelConfig.age} years old, ${ethnicity} ${modelConfig.gender} with ${modelConfig.skinTone} skin tone, ${modelConfig.bodyType} body type, pose ${modelConfig.pose}, expression ${modelConfig.expression}`
  }

  // 3. 场景描述
  async describeScene(sceneConfig: SceneConfig, userApiKey?: string): Promise<string> {
    // 补充提示词（两种模式通用）
    const extraPrompt = sceneConfig.prompt ? `, ${sceneConfig.prompt}` : ''

    if (sceneConfig.mode === 'replace' && sceneConfig.imageUrl) {
      const desc = await this.analyzeImage(
        sceneConfig.imageUrl,
        'Describe the background scene AND the person\'s pose in concise English. Include: (1) location type, architecture, setting, atmosphere; (2) the exact body pose, gesture, and posture of the person. Ignore the person\'s face and clothing. Return two sentences only.',
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
    const depthOfField = sceneConfig.depthOfField
    const aspectRatio = sceneConfig.aspectRatio

    if (isReplaceMode) {
      return [
        'Generate one photorealistic fashion image by REPLACING the person in the last reference image.',
        `New model: ${modelDescription}. If a model face reference image is provided, use that person's face, hair and skin tone.`,
        `Clothing: ${clothingDescription}. The new model must wear this garment.`,
        `Pose and background: ${sceneDescription}. The new model must adopt this exact pose in this exact background. Preserve the background, lighting, and composition from the scene reference image.`,
        'CRITICAL: Delete the original person from the scene reference. Only keep the background and pose. Insert the new model with the specified face, body, and clothing.',
        'Maintain natural skin texture, realistic textile folds, accurate garment details, and premium editorial quality.',
        'Return only the final image as base64 data without markdown.',
      ].join(' ')
    }

    const isUploadScene = sceneConfig.sceneSource === 'upload'

    let depthEffect: string
    let avoidTerms: string

    if (depthOfField === 'deep') {
      depthEffect = 'deep depth of field, sharp focus throughout the entire image, background fully in focus with crisp details, no background blur, clear background details, f/16 aperture effect'
      avoidTerms = 'Avoid illustration style, extra limbs, warped hands, distorted clothing structure, duplicated accessories, text overlays, AI artifacts, background blur, bokeh effect, shallow depth of field, out of focus background, over-sharpened, waxy skin, plastic skin texture'
    } else if (depthOfField === 'slight') {
      depthEffect = 'slight depth of field, gentle natural background blur, soft bokeh, f/4 aperture effect'
      avoidTerms = 'Avoid illustration style, extra limbs, warped hands, distorted clothing structure, duplicated accessories, text overlays, AI artifacts, heavy bokeh, over-sharpened, waxy skin, plastic skin texture'
    } else {
      depthEffect = 'shallow depth of field, bokeh background, soft background blur'
      avoidTerms = 'Avoid illustration style, extra limbs, warped hands, distorted clothing structure, duplicated accessories, text overlays, AI artifacts, over-sharpened, waxy skin, plastic skin texture'
    }

    let aspectGuidance = ''
    if (aspectRatio === '1:1') aspectGuidance = 'square format composition, centered subject'
    else if (aspectRatio === '3:4') aspectGuidance = 'portrait orientation, vertical composition, 3:4 aspect ratio'
    else if (aspectRatio === '4:3') aspectGuidance = 'landscape orientation, horizontal composition, 4:3 aspect ratio'
    else if (aspectRatio === '9:16') aspectGuidance = 'vertical portrait orientation, tall composition, 9:16 aspect ratio, mobile screen format'
    else if (aspectRatio === '16:9') aspectGuidance = 'wide landscape orientation, cinematic widescreen composition, 16:9 aspect ratio'

    const lightingIntegration = isUploadScene
      ? 'UNIFIED GLOBAL ILLUMINATION: The person and scene MUST share the EXACT SAME lighting system. Light direction, color temperature, shadow angle and ambient reflections on the person MUST perfectly match the scene environment. Apply scene light source to person: matching highlight positions on skin and hair, consistent diffuse reflection on clothing fabric, correct subsurface scattering on skin (warm translucency in backlit/rim light, cool shadow tones in overcast), and proper ambient occlusion where body contacts ground or nearby surfaces. Person must cast shadows consistent with scene light direction. NO separate lighting on the person — they exist within the scene light, not in front of it. Shot on Sony A7IV with 85mm f/1.4 lens, natural film grain, organic skin texture with visible pores, soft natural highlights, realistic color rendition, DSLR raw photo quality'
      : 'cinematic lighting'

    return [
      'Generate one photorealistic fashion campaign image that looks like a real photograph, not a CGI render.',
      `Keep the garment faithful to the clothing reference: ${clothingDescription}.`,
      `Model requirement: ${modelDescription}.`,
      `Scene requirement: ${sceneDescription}.`,
      `Create a candid street-fashion look with realistic textile folds, accurate garment details, balanced anatomy, natural skin texture with visible pores and subtle imperfections, ${lightingIntegration}, ${depthEffect}${aspectGuidance ? `, ${aspectGuidance}` : ''} and premium editorial quality.`,
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
    const content: ChatMessageContentPart[] = [{ type: 'text', text: prompt }]

    // 替换模式：模特参考图(新人物锚点) → 服装图 → 场景参考图(姿势+背景)
    // 模特图放最前面，AI 优先用这张脸而非原图的脸
    // 普通模式：服装图 → 模特参考图 → 场景参考图
    if (references.sceneConfig.mode === 'replace') {
      // 1. 模特参考图（新人物面部锚点，最优先）
      if (references.modelConfig.mode === 'upload' && references.modelConfig.imageUrl) {
        content.push({
          type: 'image_url',
          image_url: {
            url: await this.toDataUrl(references.modelConfig.imageUrl),
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
      systemPrompt = 'You are an expert fashion image compositing model. You receive up to 3 images: (1) MODEL FACE reference — use this person\'s face, hair and skin tone for the new model. (2) CLOTHING reference — the garment the new model must wear. (3) SCENE/POSE reference — use ONLY the background and body pose from this image. CRITICAL: You must DELETE the person in the scene reference image entirely and replace them with a NEW person whose face comes from image 1, wearing clothing from image 2, in the exact pose from image 3. LIGHTING COHERENCE: The new person MUST share the exact same lighting as the scene — matching light direction on skin highlights, shadow angles, color temperature, ambient bounce light, subsurface scattering on skin, and ambient occlusion at ground contact. No separate or added lighting on the person. Preserve the exact background, lighting, and composition from the scene reference. Return only the generated image in base64 without markdown or explanation.'
    } else if (references.sceneConfig.sceneSource === 'upload') {
      systemPrompt = 'You are an expert fashion image generation model. You may receive up to 3 images: (1) MODEL FACE reference (if provided) — you MUST use this person\'s face, hair and skin tone for the generated model. (2) CLOTHING reference — the garment the model must wear. (3) SCENE reference — use ONLY the background and atmosphere from this image. CRITICAL LIGHTING RULES: (1) Analyze the scene reference lighting — light source direction, color temperature, shadow direction, ambient bounce light color. (2) The generated person MUST be lit by the EXACT SAME lighting as the scene: matching highlight positions on skin and hair, consistent diffuse reflection on clothing, correct subsurface scattering on skin (warm translucency in backlit, cool shadows in overcast), ambient occlusion at ground contact, and shadows cast by the person must match scene light direction. (3) NO separate or additional lighting on the person. They exist within the scene light, not in front of it. (4) If a model face image is provided, the generated person\'s face MUST match it, NOT any person in the scene reference. The scene reference provides background and lighting ONLY, ignore any people in it. Return only the generated image in base64 without markdown or explanation.'
    } else {
      systemPrompt = 'You are an expert fashion image model. When a model reference image is provided, extract ONLY facial features, hair, and skin tone. The pose, expression, lighting, and aspect ratio MUST come from the text prompt, not from the reference images. IMPORTANT: Ignore the dimensions and aspect ratio of all reference images. Generate the output image with the exact aspect ratio specified in the prompt. Return only the generated image in base64 without markdown or explanation.'
    }

    const response = await this.requestChatCompletion({
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
    }, userApiKey)

    const image = this.extractImagePayload(response)
    const extension = extensionByMime[image.mimeType] || '.png'
    const fileName = `${taskId}${extension}`
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
      'Generate a photorealistic half-body portrait (waist up) of a new model.',
      fusionInstruction,
      'IMPORTANT: The person MUST wear the EXACT same clothing as shown in the reference photo(s). Do NOT change, simplify, or replace the clothing with a generic white t-shirt or plain shirt. Preserve every detail of the original outfit — fabric, color, pattern, neckline, sleeves, accessories.',
      'FRONT-FACING pose only — face fully visible from the front, no side profile or 3/4 angle. Confident natural expression.',
      'Bright studio lighting: key light + fill light + rim light, face clearly illuminated, no harsh shadows.',
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
          content: 'You are an expert portrait generation model. Create a NEW person by blending facial features from the provided reference photos. CRITICAL: The generated person MUST wear the exact same clothing shown in the reference photo — do NOT replace it with a white t-shirt, plain shirt, or any default/generic outfit. Preserve the original clothing faithfully. The result must be: front-facing (no side profile), bright studio lighting, photorealistic half-body portrait. Return only the generated image in base64 without markdown or explanation.',
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

  // 5. 图片放大 - 使用 images/edits API 实现真正的分辨率放大
  async upscaleImage(
    taskId: string,
    sourceUrl: string,
    factor: number = 2,
    userApiKey?: string
  ): Promise<string> {
    const apiKey = userApiKey || config.aiApiKey
    if (!apiKey) {
      throw new Error('未配置 AI API Key，请联系管理员')
    }

    // 将源图转为 base64
    const dataUrl = await this.toDataUrl(sourceUrl)
    const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
    if (!base64Match) {
      throw new Error('无法解析源图片数据')
    }
    const sourceBase64 = base64Match[1]
    const sourceBuffer = Buffer.from(sourceBase64, 'base64')

    // 获取原图尺寸以保持比例
    const sourceDimensions = this.getImageDimensions(sourceBuffer)
    const isPortrait = sourceDimensions.height > sourceDimensions.width
    const isLandscape = sourceDimensions.width > sourceDimensions.height

    // API 支持的尺寸列表
    // nano-banana-2 / gpt-image-1 支持: 1024x1024, 1024x1536, 1536x1024, 1024x1792, 1792x1024
    const sizeMap: Record<number, string> = {
      2: isPortrait ? '1024x1536' : isLandscape ? '1536x1024' : '1792x1792',
      4: isPortrait ? '1024x1792' : isLandscape ? '1792x1024' : '1792x1792',
    }
    const targetSize = sizeMap[factor] || sizeMap[2]

    // 使用 images/edits 端点实现放大
    const formData = new FormData()
    formData.append('model', config.aiModel)
    formData.append('image', new Blob([sourceBuffer]), 'image.png')
    formData.append('prompt', 'Upscale and enhance this image to higher resolution. Preserve all details, textures, and colors exactly. Improve sharpness and clarity.')
    formData.append('size', targetSize)
    formData.append('n', '1')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.aiRequestTimeoutMs)

    try {
      const response = await fetch(`${config.aiApiBaseUrl}/images/edits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      })

      const raw = await response.text()
      const data = this.parseJson<any>(raw)

      if (!response.ok) {
        const message = data?.error?.message || raw || `HTTP ${response.status}`
        throw new Error(`图片放大接口请求失败：${message}`)
      }

      // 从 images/edits 响应中提取图片
      let imageBase64: string | null = null
      let imageMimeType = 'image/png'

      // 标准 OpenAI images API 响应格式：{ data: [{ b64_json: "...", url: "..." }] }
      if (data?.data?.[0]) {
        const item = data.data[0]
        if (item.b64_json) {
          imageBase64 = this.cleanBase64(item.b64_json)
          imageMimeType = this.normalizeMimeType(item.mime_type || item.media_type) || 'image/png'
        } else if (item.url) {
          // 如果返回的是 URL，下载图片
          const imgResponse = await fetch(item.url)
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
          imageBase64 = imgBuffer.toString('base64')
          imageMimeType = this.normalizeMimeType(imgResponse.headers.get('content-type') || undefined) || 'image/png'
        }
      }

      // 也检查 choices 格式（某些模型可能用 chat completions 格式）
      if (!imageBase64) {
        const fromContent = this.extractImageFromUnknown(data?.choices?.[0]?.message?.content)
        if (fromContent) {
          imageBase64 = fromContent.base64
          imageMimeType = fromContent.mimeType
        }
      }

      if (!imageBase64) {
        throw new Error('图片放大接口未返回图片数据')
      }

      const extension = extensionByMime[imageMimeType] || '.png'
      const fileName = `${taskId}_upscaled_${factor}x${extension}`
      const filePath = path.join(getUploadPath(), 'upscaled', fileName)

      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, Buffer.from(imageBase64, 'base64'))
      return toStoredFilePath(`uploads/upscaled/${fileName}`)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`图片放大请求超时（>${config.aiRequestTimeoutMs}ms）`)
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
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

    try {
      const response = await fetch(`${config.aiApiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

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

  private async toDataUrl(source: string): Promise<string> {
    if (source.startsWith('data:')) return source

    const localPath = this.resolveLocalUploadPath(source)
    if (localPath) {
      const buffer = await fs.readFile(localPath)
      const mimeType = this.getMimeTypeFromPath(localPath) || this.detectMimeType(buffer)
      return this.bufferToDataUrl(buffer, mimeType)
    }

    if (/^https?:\/\//i.test(source)) {
      const response = await fetch(source)
      if (!response.ok) throw new Error(`无法读取参考图片：${source}`)

      const buffer = Buffer.from(await response.arrayBuffer())
      const mimeType =
        this.normalizeMimeType(response.headers.get('content-type') || undefined) ||
        this.getMimeTypeFromPath(new URL(source).pathname) ||
        this.detectMimeType(buffer)
      return this.bufferToDataUrl(buffer, mimeType)
    }

    const absolutePath = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source)
    const buffer = await fs.readFile(absolutePath)
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
