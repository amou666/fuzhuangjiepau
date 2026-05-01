import { db } from './db'
import { queries } from './db-queries'

export function getTaskStatus(taskId: string) {
  return queries.task.findStatusById(taskId)
}
