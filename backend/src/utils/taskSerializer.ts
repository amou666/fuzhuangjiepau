import type { Request } from 'express';
import type { GenerationTask } from '@prisma/client';
import type { ModelConfig, SceneConfig, TaskStatus } from '../types';
import { toPublicFileUrl } from './files';

const parseJson = <T>(value: string) => JSON.parse(value) as T;

const serializeUrl = (value: string | null | undefined, req?: Request) => {
  if (!value) {
    return value ?? null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return toPublicFileUrl(value, req);
};

export const serializeTask = (
  task: GenerationTask & { user?: { email: string } },
  req?: Request,
) => ({
  ...task,
  clothingUrl: serializeUrl(task.clothingUrl, req) ?? task.clothingUrl,
  resultUrl: serializeUrl(task.resultUrl, req),
  upscaledUrl: serializeUrl(task.upscaledUrl, req),
  status: task.status as TaskStatus,
  modelConfig: parseJson<ModelConfig>(task.modelConfig),
  sceneConfig: parseJson<SceneConfig>(task.sceneConfig),
  user: task.user,
});
