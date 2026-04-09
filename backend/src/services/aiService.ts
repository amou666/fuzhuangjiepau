import fs from 'fs/promises';
import path from 'path';
import type { ModelConfig, SceneConfig } from '../types';
import { config } from '../config';
import { toStoredFilePath } from '../utils/files';

type ChatMessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } };

type ChatCompletionResponse = {
  error?: { message?: string };
  choices?: Array<{
    message?: {
      content?: unknown;
      images?: Array<{
        b64_json?: string;
        mime_type?: string;
        media_type?: string;
      }>;
    };
  }>;
  data?: Array<{
    b64_json?: string;
    mime_type?: string;
    media_type?: string;
  }>;
};

type ImagePayload = {
  base64: string;
  mimeType: string;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const mimeByExtension: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const extensionByMime: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

export class AIService {
  static async analyzeClothing(clothingUrl: string) {
    if (config.mockAi) {
      const filename = clothingUrl.split('/').pop()?.split('?')[0] || '服装图';
      return `a premium fashion garment based on ${filename}, refined texture, editorial tailoring and strong streetwear silhouette`;
    }

    return this.analyzeImage(
      clothingUrl,
      'You are a senior fashion stylist. Describe only the garment in concise English for downstream image generation. Focus on category, color, fabric, silhouette, patterns, trims, logos and styling details. Ignore the background, model and camera info. Return one sentence only.',
    );
  }

  static async describeModel(modelConfig: ModelConfig) {
    // 类别描述：普通女孩 vs 时尚超模
    const categoryStyle = modelConfig.category === 'supermodel'
      ? 'professional fashion supermodel with striking features, editorial look, high-fashion appeal'
      : 'natural everyday girl next door, relatable and approachable, authentic beauty';

    // 人种描述
    const ethnicityStyle: Record<string, string> = {
      Chinese: 'Chinese',
      American: 'American',
      British: 'British',
      French: 'French',
      Korean: 'Korean',
      Japanese: 'Japanese',
      Indian: 'Indian',
    };
    const ethnicity = ethnicityStyle[modelConfig.ethnicity] || 'Chinese';

    if (modelConfig.mode === 'upload' && modelConfig.imageUrl) {
      if (config.mockAi) {
        return `reference model from ${modelConfig.imageUrl}, ${categoryStyle}, ${modelConfig.age} years old, ${ethnicity}, pose ${modelConfig.pose}, expression ${modelConfig.expression}`;
      }

      const facialDescription = await this.analyzeImage(
        modelConfig.imageUrl,
        'Describe ONLY the facial features (face shape, eyes, nose, mouth), hair style and color, skin tone, and body type. DO NOT describe pose, gesture, expression, or lighting. Return one sentence only.',
      );
      return `${categoryStyle}, ${modelConfig.age} years old, ${ethnicity}, ${facialDescription}, pose ${modelConfig.pose}, expression ${modelConfig.expression}`;
    }

    return `a ${categoryStyle}, ${modelConfig.age} years old, ${ethnicity} ${modelConfig.gender} with ${modelConfig.skinTone} skin tone, ${modelConfig.bodyType} body type, pose ${modelConfig.pose}, expression ${modelConfig.expression}`;
  }

  static async describeScene(sceneConfig: SceneConfig) {
    if (sceneConfig.mode === 'replace' && sceneConfig.imageUrl) {
      if (config.mockAi) {
        return `replace mode: using background and pose from ${sceneConfig.imageUrl}`;
      }

      return this.analyzeImage(
        sceneConfig.imageUrl,
        'Describe ONLY the background scene and environment in concise English. Focus on location type, architecture, setting, and atmosphere. Ignore any people. Return one sentence only.',
      );
    }

    if (sceneConfig.mode === 'upload' && sceneConfig.imageUrl) {
      if (config.mockAi) {
        return `real location inspired by uploaded scene ${sceneConfig.imageUrl}`;
      }

      return this.analyzeImage(
        sceneConfig.imageUrl,
        'Describe the background scene AND lighting conditions in concise English for photorealistic fashion photography. You MUST include: (1) location type and architecture, (2) PRIMARY LIGHT SOURCE direction (e.g., light from upper left, backlit, overhead), (3) light color temperature (warm/cool/neutral), (4) shadow characteristics (soft/hard, direction), (5) ambient light reflections from surrounding surfaces. This lighting info is CRITICAL for placing a person into this scene realistically. Ignore any foreground people. Return 2-3 sentences.',
      );
    }

    // 构建场景描述，包含预设、时段、光照、构图等信息
    const parts: string[] = [sceneConfig.preset];
    
    if (sceneConfig.timeOfDay) {
      parts.push(sceneConfig.timeOfDay);
    }
    
    if (sceneConfig.lighting) {
      parts.push(sceneConfig.lighting);
    }
    
    if (sceneConfig.composition) {
      parts.push(sceneConfig.composition);
    }
    
    if (sceneConfig.prompt) {
      parts.push(sceneConfig.prompt);
    }
    
    return parts.join(', ');
  }

  static async describePoseFromReference(imageUrl: string) {
    if (config.mockAi) {
      return 'standing pose from reference image';
    }

    return this.analyzeImage(
      imageUrl,
      'Describe ONLY the body pose, gesture, and stance of the person in this image. Focus on arm position, leg position, body angle, and overall posture. Ignore clothing, face, and background. Return one sentence only.',
    );
  }

  static buildStreetFashionPrompt(
    clothingDescription: string,
    modelDescription: string,
    sceneDescription: string,
    depthOfField?: 'slight' | 'shallow' | 'deep',
    aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9',
    poseDescription?: string,
    isReplaceMode?: boolean,
    isUploadScene?: boolean,
  ) {
    // 替换模式：保留参考图的背景和姿势，只替换模特和服装
    if (isReplaceMode && poseDescription) {
      return [
        'Generate one photorealistic fashion image by REPLACING the person in the reference.',
        `Keep the garment faithful to the clothing reference: ${clothingDescription}.`,
        `Model requirement: ${modelDescription}.`,
        `Pose requirement: ${poseDescription}. The model MUST adopt this exact pose from the reference image.`,
        `Scene requirement: ${sceneDescription}. The background MUST match the reference image exactly.`,
        'Preserve the exact background, setting, lighting, and composition from the reference image.',
        'Only replace the person with the new model wearing the new clothing.',
        'Maintain natural skin texture, realistic textile folds, accurate garment details, and premium editorial quality.',
        'Return only the final image as base64 data without markdown.',
      ].join(' ');
    }

    // 根据景深选项生成不同的效果描述
    let depthEffect: string;
    let avoidTerms: string;

    if (depthOfField === 'deep') {
      // 深景深：强调背景清晰、细节丰富
      depthEffect =
        'deep depth of field, sharp focus throughout the entire image, background fully in focus with crisp details, high resolution background, no background blur, clear background details, f/16 aperture effect';
      avoidTerms =
        'Avoid illustration style, extra limbs, warped hands, distorted clothing structure, duplicated accessories, text overlays, AI artifacts, background blur, bokeh effect, shallow depth of field, out of focus background';
    } else if (depthOfField === 'slight') {
      // 轻微景深：自然虚化
      depthEffect = 'slight depth of field, gentle natural background blur, soft bokeh, f/4 aperture effect';
      avoidTerms =
        'Avoid illustration style, extra limbs, warped hands, distorted clothing structure, duplicated accessories, text overlays and AI artifacts, heavy bokeh.';
    } else {
      // 浅景深：背景虚化突出主体
      depthEffect = 'shallow depth of field, bokeh background, soft background blur';
      avoidTerms =
        'Avoid illustration style, extra limbs, warped hands, distorted clothing structure, duplicated accessories, text overlays and AI artifacts.';
    }

    // 根据尺寸比例添加构图指导
    let aspectGuidance = '';
    if (aspectRatio === '1:1') {
      aspectGuidance = 'square format composition, centered subject';
    } else if (aspectRatio === '3:4') {
      aspectGuidance = 'portrait orientation, vertical composition, 3:4 aspect ratio';
    } else if (aspectRatio === '4:3') {
      aspectGuidance = 'landscape orientation, horizontal composition, 4:3 aspect ratio';
    } else if (aspectRatio === '9:16') {
      aspectGuidance = 'vertical portrait orientation, tall composition, 9:16 aspect ratio, mobile screen format';
    } else if (aspectRatio === '16:9') {
      aspectGuidance = 'wide landscape orientation, cinematic widescreen composition, 16:9 aspect ratio';
    }

    // 上传场景图时的统一全局光照系统指令
    const lightingIntegration = isUploadScene
      ? 'UNIFIED GLOBAL ILLUMINATION: The person and scene MUST share the EXACT SAME lighting system. Light direction, color temperature, shadow angle and ambient reflections on the person MUST perfectly match the scene environment. Apply scene light source to person: matching highlight positions, consistent diffuse reflection on skin and clothing, correct subsurface scattering on skin (warm translucency in backlit/rim light, cool shadow tones in overcast), and proper ambient occlusion where body contacts ground or nearby surfaces. Person must cast shadows consistent with scene light direction. NO separate lighting on the person — they exist within the scene light, not in front of it. Photographic realism requires light coherence between subject and environment.'
      : 'cinematic lighting';

    return [
      'Generate one photorealistic fashion campaign image.',
      `Keep the garment faithful to the clothing reference: ${clothingDescription}.`,
      `Model requirement: ${modelDescription}.`,
      `Scene requirement: ${sceneDescription}.`,
      `Create a candid street-fashion look with realistic textile folds, accurate garment details, balanced anatomy, natural skin texture with visible pores and subtle imperfections, ${lightingIntegration}, ${depthEffect}${aspectGuidance ? `, ${aspectGuidance}` : ''} and premium editorial quality.`,
      avoidTerms,
      'Return only the final image as base64 data without markdown.',
    ].join(' ');
  }

  static async generateResultImage(
    taskId: string,
    prompt: string,
    references: {
      clothingUrl: string;
      modelConfig: ModelConfig;
      sceneConfig: SceneConfig;
    },
  ) {
    if (config.mockAi) {
      return this.generateMockResultImage(taskId, prompt);
    }

    const content: ChatMessageContentPart[] = [{ type: 'text', text: prompt }];

    // 替换模式：参考图作为主要参考，保留背景和姿势
    if (references.sceneConfig.mode === 'replace' && references.sceneConfig.imageUrl) {
      // 参考图放在最前面，作为主要参考
      content.push({
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(references.sceneConfig.imageUrl),
          detail: config.aiImageDetail,
        },
      });
    }

    content.push({
      type: 'image_url',
      image_url: {
        url: await this.toDataUrl(references.clothingUrl),
        detail: config.aiImageDetail,
      },
    });

    if (references.modelConfig.mode === 'upload' && references.modelConfig.imageUrl) {
      content.push({
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(references.modelConfig.imageUrl),
          detail: config.aiImageDetail,
        },
      });
    }

    // 非替换模式下，场景图作为参考
    if (references.sceneConfig.mode === 'upload' && references.sceneConfig.imageUrl) {
      content.push({
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(references.sceneConfig.imageUrl),
          detail: config.aiImageDetail,
        },
      });
    }

    const isUploadScene = references.sceneConfig.mode !== 'replace' && references.sceneConfig.sceneSource === 'upload'

    let systemPrompt: string
    if (references.sceneConfig.mode === 'replace') {
      systemPrompt = 'You are an expert fashion image model. The FIRST reference image shows the target pose and background. Your task is to REPLACE the person in that reference with the new model wearing the new clothing. You MUST preserve the exact background, setting, lighting, composition, and body pose from the reference image. Only change the person and their clothing. CRITICAL: The new person MUST share the exact same lighting as the scene — matching light direction, shadow angles, color temperature, ambient reflections, and subsurface scattering on skin. No separate lighting on the person. Return only the generated image in base64 without markdown or explanation.'
    } else if (isUploadScene) {
      systemPrompt = 'You are an expert fashion image generation model. You may receive images: CLOTHING reference, optional MODEL FACE reference, and a SCENE reference image. CRITICAL LIGHTING RULES: (1) Analyze the lighting in the scene reference — light direction, color temperature, shadow direction, ambient bounce light. (2) The generated person MUST be lit by the EXACT SAME lighting as the scene. Light direction on skin highlights, shadow angles on the body, ambient occlusion near ground contact, subsurface scattering on skin — all must match the scene environment. (3) The person must cast shadows consistent with the scene light source. (4) Diffuse reflection and specular highlights on clothing must match the scene illumination. (5) If scene reference contains people, ignore them — use ONLY the background and lighting. If a model face reference is provided, the generated person\'s face MUST match it. Return only the generated image in base64 without markdown or explanation.'
    } else {
      systemPrompt = 'You are an expert fashion image model. When a model reference image is provided, extract ONLY facial features, hair, and skin tone. The pose, expression, lighting, and aspect ratio MUST come from the text prompt, not from the reference images. IMPORTANT: Ignore the dimensions and aspect ratio of all reference images. Generate the output image with the exact aspect ratio specified in the prompt. Return only the generated image in base64 without markdown or explanation.'
    }

    const response = await this.requestChatCompletion({
      model: config.aiGenerationModel,
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
    });

    const image = this.extractImagePayload(response);
    const extension = extensionByMime[image.mimeType] || '.png';
    const fileName = `${taskId}${extension}`;
    const filePath = path.join(config.uploadDir, 'results', fileName);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'));
    return toStoredFilePath(`uploads/results/${fileName}`);
  }

  static async upscaleImage(
    taskId: string,
    sourceUrl: string,
    factor: number = 2,
  ): Promise<string> {
    if (config.mockAi) {
      return this.generateMockUpscaledImage(taskId, sourceUrl, factor);
    }

    const content: ChatMessageContentPart[] = [
      {
        type: 'text',
        text: `Upscale this image by ${factor}x while preserving details and improving sharpness. Return only the upscaled image as base64.`,
      },
      {
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(sourceUrl),
          detail: config.aiImageDetail,
        },
      },
    ];

    const response = await this.requestChatCompletion({
      model: config.aiGenerationModel,
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert image upscaling model. Upscale the provided image to higher resolution while preserving and enhancing details. Return only the upscaled image in base64 format.',
        },
        {
          role: 'user',
          content,
        },
      ],
    });

    const image = this.extractImagePayload(response);
    const extension = extensionByMime[image.mimeType] || '.png';
    const fileName = `${taskId}_upscaled_${factor}x${extension}`;
    const filePath = path.join(config.uploadDir, 'upscaled', fileName);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(image.base64, 'base64'));
    return toStoredFilePath(`uploads/upscaled/${fileName}`);
  }

  private static async analyzeImage(imageUrl: string, instruction: string) {
    const response = await this.requestChatCompletion({
      model: config.aiAnalysisModel,
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
    });

    const content = this.extractTextContent(response);
    if (!content) {
      throw new Error('AI 分析接口未返回有效描述');
    }

    return content;
  }

  private static async requestChatCompletion(payload: Record<string, unknown>) {
    if (!config.aiApiKey) {
      throw new Error('未配置 AI_API_KEY，无法调用真实 AI 接口');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.aiRequestTimeoutMs);

    try {
      const response = await fetch(`${config.aiApiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.aiApiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const raw = await response.text();
      const data = this.parseJson<ChatCompletionResponse>(raw);

      if (!response.ok) {
        const message = data?.error?.message || raw || `HTTP ${response.status}`;
        throw new Error(`AI 接口请求失败：${message}`);
      }

      return data ?? {};
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`AI 接口请求超时（>${config.aiRequestTimeoutMs}ms）`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private static async generateMockResultImage(taskId: string, prompt: string) {
    const fileName = `${taskId}.svg`;
    const filePath = path.join(config.uploadDir, 'results', fileName);
    const previewText = escapeXml(prompt.slice(0, 220));
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef3f2" />
      <stop offset="50%" stop-color="#f0fdf4" />
      <stop offset="100%" stop-color="#eff6ff" />
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)" rx="56" />
  <rect x="72" y="72" width="880" height="880" rx="40" fill="rgba(255,255,255,0.72)" stroke="rgba(255,255,255,0.9)" />
  <text x="120" y="180" font-size="42" font-family="Arial, sans-serif" fill="#111827" font-weight="700">Fashion AI Demo Result</text>
  <text x="120" y="240" font-size="24" font-family="Arial, sans-serif" fill="#374151">Mock AI output is enabled for local runnable mode.</text>
  <foreignObject x="120" y="300" width="784" height="520">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: #1f2937; font-size: 28px; line-height: 1.6; white-space: pre-wrap;">
      ${previewText}
    </div>
  </foreignObject>
  <text x="120" y="860" font-size="22" font-family="Arial, sans-serif" fill="#6b7280">Task ID: ${escapeXml(taskId)}</text>
</svg>`;

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, svg, 'utf8');
    return toStoredFilePath(`uploads/results/${fileName}`);
  }

  private static async generateMockUpscaledImage(
    taskId: string,
    sourceUrl: string,
    factor: number,
  ): Promise<string> {
    const fileName = `${taskId}_upscaled_${factor}x.svg`;
    const filePath = path.join(config.uploadDir, 'upscaled', fileName);
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${1024 * factor}" height="${1024 * factor}" viewBox="0 0 ${1024 * factor} ${1024 * factor}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ecfdf5" />
      <stop offset="50%" stop-color="#f0fdf4" />
      <stop offset="100%" stop-color="#d1fae5" />
    </linearGradient>
  </defs>
  <rect width="${1024 * factor}" height="${1024 * factor}" fill="url(#bg)" rx="${56 * factor}" />
  <rect x="${72 * factor}" y="${72 * factor}" width="${880 * factor}" height="${880 * factor}" rx="${40 * factor}" fill="rgba(255,255,255,0.72)" stroke="rgba(255,255,255,0.9)" />
  <text x="${120 * factor}" y="${180 * factor}" font-size="${42 * factor}" font-family="Arial, sans-serif" fill="#111827" font-weight="700">Upscaled Image (${factor}x)</text>
  <text x="${120 * factor}" y="${240 * factor}" font-size="${24 * factor}" font-family="Arial, sans-serif" fill="#374151">Mock AI upscale demo - ${factor}x resolution enhancement</text>
  <text x="${120 * factor}" y="${320 * factor}" font-size="${20 * factor}" font-family="Arial, sans-serif" fill="#6b7280">Source: ${escapeXml(sourceUrl)}</text>
  <text x="${120 * factor}" y="${860 * factor}" font-size="${22 * factor}" font-family="Arial, sans-serif" fill="#6b7280">Task ID: ${escapeXml(taskId)}</text>
</svg>`;

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, svg, 'utf8');
    return toStoredFilePath(`uploads/upscaled/${fileName}`);
  }

  private static parseJson<T>(value: string) {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private static extractTextContent(response: ChatCompletionResponse) {
    const content = response.choices?.[0]?.message?.content;

    if (typeof content === 'string') {
      return content.trim();
    }

    if (!Array.isArray(content)) {
      return '';
    }

    const text = content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (!item || typeof item !== 'object') {
          return '';
        }

        const textValue = Reflect.get(item, 'text');
        if (typeof textValue === 'string') {
          return textValue;
        }

        const nestedContent = Reflect.get(item, 'content');
        return typeof nestedContent === 'string' ? nestedContent : '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();

    return text;
  }

  private static extractImagePayload(response: ChatCompletionResponse): ImagePayload {
    const directData = response.data?.find((item) => typeof item.b64_json === 'string' && item.b64_json.trim());
    if (directData?.b64_json) {
      return {
        base64: this.cleanBase64(directData.b64_json),
        mimeType: this.normalizeMimeType(directData.mime_type || directData.media_type) || 'image/png',
      };
    }

    const message = response.choices?.[0]?.message;
    const directImage = message?.images?.find((item) => typeof item.b64_json === 'string' && item.b64_json.trim());
    if (directImage?.b64_json) {
      return {
        base64: this.cleanBase64(directImage.b64_json),
        mimeType: this.normalizeMimeType(directImage.mime_type || directImage.media_type) || 'image/png',
      };
    }

    const fromContent = this.extractImageFromUnknown(message?.content);
    if (fromContent) {
      return fromContent;
    }

    throw new Error('AI 生图接口未返回 base64 图片数据');
  }

  private static extractImageFromUnknown(value: unknown): ImagePayload | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      const fromDataUrl = this.parseDataUrl(value);
      if (fromDataUrl) {
        return fromDataUrl;
      }

      const fromMarkdownImage = this.parseMarkdownImageDataUrl(value);
      if (fromMarkdownImage) {
        return fromMarkdownImage;
      }

      const parsed = this.parseJson<unknown>(value);
      if (parsed) {
        return this.extractImageFromUnknown(parsed);
      }

      if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s+/g, '').length > 128) {
        return {
          base64: this.cleanBase64(value),
          mimeType: 'image/png',
        };
      }

      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const image = this.extractImageFromUnknown(item);
        if (image) {
          return image;
        }
      }

      return null;
    }

    if (typeof value !== 'object') {
      return null;
    }

    const b64 = Reflect.get(value, 'b64_json');
    if (typeof b64 === 'string' && b64.trim()) {
      return {
        base64: this.cleanBase64(b64),
        mimeType:
          this.normalizeMimeType(this.readStringField(value, ['mime_type', 'media_type', 'mimeType'])) || 'image/png',
      };
    }

    const imageBase64 = this.readStringField(value, ['image_base64', 'base64', 'data']);
    if (imageBase64) {
      const fromDataUrl = this.parseDataUrl(imageBase64);
      if (fromDataUrl) {
        return fromDataUrl;
      }

      return {
        base64: this.cleanBase64(imageBase64),
        mimeType:
          this.normalizeMimeType(this.readStringField(value, ['mime_type', 'media_type', 'mimeType'])) || 'image/png',
      };
    }

    for (const nestedKey of ['image', 'content', 'source', 'output', 'result']) {
      const nested = Reflect.get(value, nestedKey);
      const image = this.extractImageFromUnknown(nested);
      if (image) {
        return image;
      }
    }

    return null;
  }

  private static readStringField(value: object, keys: string[]) {
    for (const key of keys) {
      const current = Reflect.get(value, key);
      if (typeof current === 'string' && current.trim()) {
        return current;
      }
    }

    return '';
  }

  private static parseDataUrl(value: string): ImagePayload | null {
    const match = value.match(/^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!match) {
      return null;
    }

    return {
      mimeType: this.normalizeMimeType(match[1]) || 'image/png',
      base64: this.cleanBase64(match[2]),
    };
  }

  private static parseMarkdownImageDataUrl(value: string): ImagePayload | null {
    const match = value.match(/!\[[^\]]*\]\((data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]+)\)/i);
    if (!match) {
      return null;
    }

    return this.parseDataUrl(match[1]);
  }

  private static cleanBase64(value: string) {
    return value.replace(/\s+/g, '');
  }

  private static normalizeMimeType(value: string | undefined) {
    return value?.split(';')[0]?.trim().toLowerCase() || '';
  }

  private static async toDataUrl(source: string) {
    if (source.startsWith('data:')) {
      return source;
    }

    const localPath = this.resolveLocalUploadPath(source);
    if (localPath) {
      const buffer = await fs.readFile(localPath);
      const mimeType = this.getMimeTypeFromPath(localPath) || this.detectMimeType(buffer);
      this.assertSupportedReferenceMimeType(mimeType);
      return this.bufferToDataUrl(buffer, mimeType);
    }

    if (/^https?:\/\//i.test(source)) {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`无法读取参考图片：${source}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const mimeType =
        this.normalizeMimeType(response.headers.get('content-type') || undefined) ||
        this.getMimeTypeFromPath(new URL(source).pathname) ||
        this.detectMimeType(buffer);
      return this.bufferToDataUrl(buffer, mimeType);
    }

    const absolutePath = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source);
    const buffer = await fs.readFile(absolutePath);
    return this.bufferToDataUrl(buffer, this.getMimeTypeFromPath(absolutePath) || this.detectMimeType(buffer));
  }

  private static bufferToDataUrl(buffer: Buffer, mimeType: string) {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  private static resolveLocalUploadPath(source: string) {
    const asPath = source.startsWith('/uploads/') ? source : this.extractUploadPathname(source);
    if (!asPath) {
      return '';
    }

    const relative = asPath.replace(/^\/uploads\/?/, '');
    const baseDir = path.resolve(config.uploadDir);
    const resolved = path.resolve(baseDir, relative);
    return resolved.startsWith(baseDir) ? resolved : '';
  }

  private static extractUploadPathname(source: string) {
    try {
      const url = new URL(source);
      return url.pathname.startsWith('/uploads/') ? url.pathname : '';
    } catch {
      return '';
    }
  }

  private static getMimeTypeFromPath(filePath: string) {
    return mimeByExtension[path.extname(filePath).toLowerCase()] || '';
  }

  private static assertSupportedReferenceMimeType(mimeType: string) {
    if (mimeType === 'image/svg+xml') {
      throw new Error('真实 AI 模式暂不支持 SVG 参考图，请上传 PNG、JPG、JPEG、WEBP 或 GIF');
    }
  }

  private static detectMimeType(buffer: Buffer) {
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return 'image/png';
    }

    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
      return 'image/jpeg';
    }

    if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') {
      return 'image/gif';
    }

    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
      return 'image/webp';
    }

    if (buffer.subarray(0, 200).toString('utf8').includes('<svg')) {
      return 'image/svg+xml';
    }

    return 'image/png';
  }
}
