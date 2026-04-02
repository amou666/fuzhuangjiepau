import path from 'path';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml']);

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const isValidEmail = (value: string) => {
  const normalized = normalizeEmail(value);
  return normalized.length <= 254 && EMAIL_REGEX.test(normalized);
};

export const hasMinPasswordLength = (value: string, min = 6) => value.length >= min;

export const toPositiveInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const toOptionalNonNegativeInt = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

export const isAllowedImageExtension = (fileName: string) => ALLOWED_IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());

export const isAllowedImageMimeType = (mimeType: string) => ALLOWED_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
