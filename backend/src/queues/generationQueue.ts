import { processTask } from '../services/taskProcessor';

export const enqueueGenerationTask = (taskId: string) => {
  setTimeout(() => {
    void processTask(taskId);
  }, 300);
};
