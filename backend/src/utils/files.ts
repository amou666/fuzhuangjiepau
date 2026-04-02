import fs from 'fs';
import path from 'path';
import type { Request } from 'express';
import { config } from '../config';

export const ensureUploadDirectories = () => {
  fs.mkdirSync(config.uploadDir, { recursive: true });
  fs.mkdirSync(path.join(config.uploadDir, 'results'), { recursive: true });
};

export const toStoredFilePath = (relativeFilePath: string) => {
  const normalized = relativeFilePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return `/${normalized}`;
};

const getRequestBaseUrl = (req: Request) => {
  const forwardedProtocol = req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProtocol || req.protocol;
  const host = req.header('x-forwarded-host') || req.get('host');
  return host ? `${protocol}://${host}` : '';
};

export const toPublicFileUrl = (relativeFilePath: string, req?: Request) => {
  const normalizedPath = toStoredFilePath(relativeFilePath);
  const baseUrl = req ? getRequestBaseUrl(req) : config.publicApiBaseUrl;
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
};
