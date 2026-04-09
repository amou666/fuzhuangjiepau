import { db } from './db'

export function getTaskStatus(taskId: string) {
  return db.prepare('SELECT id, status, resultUrl, upscaledUrl, errorMsg FROM GenerationTask WHERE id = ?').get(taskId) as any
}
