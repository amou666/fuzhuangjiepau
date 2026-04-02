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
    if (modelConfig.mode === 'upload' && modelConfig.imageUrl) {
      if (config.mockAi) {
        return `reference model from ${modelConfig.imageUrl}, ${modelConfig.gender}, ${modelConfig.bodyType}, pose ${modelConfig.pose}, expression ${modelConfig.expression}`;
      }

      return this.analyzeImage(
        modelConfig.imageUrl,
        'Describe the person in concise English for fashion image generation. Focus on gender presentation, hair, face impression, body type, pose and expression. Ignore the background and clothing details unless they affect body silhouette. Return one sentence only.',
      );
    }

    return `a ${modelConfig.gender} model with ${modelConfig.skinTone} skin tone, ${modelConfig.bodyType} body type, pose ${modelConfig.pose}, expression ${modelConfig.expression}`;
  }

  static async describeScene(sceneConfig: SceneConfig) {
    if (sceneConfig.mode === 'upload' && sceneConfig.imageUrl) {
      if (config.mockAi) {
        return `real location inspired by uploaded scene ${sceneConfig.imageUrl}`;
      }

      return this.analyzeImage(
        sceneConfig.imageUrl,
        'Describe the background scene in concise English for photorealistic fashion photography. Focus on location type, architecture, composition, lighting, depth and atmosphere. Ignore any foreground people. Return one sentence only.',
      );
    }

    const prompt = sceneConfig.prompt ? ` with ${sceneConfig.prompt}` : '';
    return `${sceneConfig.preset}${prompt}`;
  }

  static buildStreetFashionPrompt(clothingDescription: string, modelDescription: string, sceneDescription: string) {
    return [
      'Generate one photorealistic fashion campaign image.',
      `Keep the garment faithful to the clothing reference: ${clothingDescription}.`,
      `Model requirement: ${modelDescription}.`,
      `Scene requirement: ${sceneDescription}.`,
      'Create a candid street-fashion look with realistic textile folds, accurate garment details, balanced anatomy, natural skin texture, cinematic lighting, shallow depth of field and premium editorial quality.',
      'Avoid illustration style, extra limbs, warped hands, distorted clothing structure, duplicated accessories, text overlays and AI artifacts.',
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

    if (references.sceneConfig.mode === 'upload' && references.sceneConfig.imageUrl) {
      content.push({
        type: 'image_url',
        image_url: {
          url: await this.toDataUrl(references.sceneConfig.imageUrl),
          detail: config.aiImageDetail,
        },
      });
    }

    const response = await this.requestChatCompletion({
      model: config.aiGenerationModel,
      stream: false,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert fashion image model. Use the provided references to generate a realistic image and return only the generated image in base64. Do not include markdown or explanation.',
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
