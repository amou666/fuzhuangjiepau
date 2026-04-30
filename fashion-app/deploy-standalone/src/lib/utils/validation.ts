const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_IMAGE_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const isValidEmail = (value: string) => EMAIL_REGEX.test(normalizeEmail(value));

export const hasMinPasswordLength = (value: string, min = 6) => value.length >= min;

export const getImageUploadError = (file: File) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
    return '仅支持 PNG / JPG / WEBP / GIF 格式';
  }

  if (file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
    return '图片大小不能超过 5MB';
  }

  return '';
};
