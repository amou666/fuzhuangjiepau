const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MAX_IMAGE_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const isValidEmail = (value: string) => EMAIL_REGEX.test(normalizeEmail(value));

export const hasMinPasswordLength = (value: string, min = 6) => value.length >= min;

export const getImageUploadError = (file: File) => {
  if (!file.type.startsWith('image/')) {
    return '仅支持上传图片文件';
  }

  if (file.size > MAX_IMAGE_UPLOAD_SIZE_BYTES) {
    return '图片大小不能超过 5MB';
  }

  return '';
};
