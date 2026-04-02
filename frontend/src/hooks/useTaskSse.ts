import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useTaskStore } from '../stores/taskStore';

interface TaskSseEvent {
  taskId: string;
  status: 'PROCESSING' | 'DONE' | 'FAILED';
  resultUrl?: string;
  errorMsg?: string;
  retrying?: boolean;
  attempt?: number;
}

/**
 * 全局 SSE Hook：在用户登录后建立长连接，接收任务状态推送
 * 只需在顶层布局 (AppLayout) 挂载一次
 */
export const useTaskSse = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const updateCredits = useAuthStore((state) => state.updateCredits);
  const { setCurrentTask, currentTask } = useTaskStore.getState();
  const addNotification = useNotificationStore((state) => state.add);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    // 关闭旧连接
    esRef.current?.close();

    // EventSource 不支持自定义 Header，用 token 作为 query param
    const url = `${API_BASE_URL}/sse/tasks?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as TaskSseEvent | { type: string };

        // 初始连接确认，忽略
        if ('type' in data) return;

        const { taskId, status, resultUrl, errorMsg } = data as TaskSseEvent;

        // 如果当前 taskStore 中的任务就是这个，直接更新
        const storeTask = useTaskStore.getState().currentTask;
        if (storeTask && storeTask.id === taskId) {
          setCurrentTask({
            ...storeTask,
            status,
            resultUrl: resultUrl ?? storeTask.resultUrl,
            errorMsg: errorMsg ?? storeTask.errorMsg,
          });
          // 若任务完成则刷新积分余额
          if (status === 'DONE' || status === 'FAILED') {
            useTaskStore.getState().markPollingDone();
          }
        }

        // 发送全局 Toast 通知
        if (status === 'DONE') {
          addNotification({ type: 'success', message: '生图任务已完成，快去查看结果！', taskId });
          // 刷新积分
          import('../api/workspace').then(({ workspaceApi }) => {
            void workspaceApi.getBalance().then(updateCredits).catch(() => undefined);
          });
        } else if (status === 'FAILED') {
          addNotification({ type: 'error', message: `生图任务失败：${errorMsg ?? '未知错误'}`, taskId });
          import('../api/workspace').then(({ workspaceApi }) => {
            void workspaceApi.getBalance().then(updateCredits).catch(() => undefined);
          });
        }
      } catch {
        // JSON 解析失败（心跳注释行），忽略
      }
    };

    es.onerror = () => {
      // 浏览器会自动重连，无需手动处理
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [accessToken, addNotification, setCurrentTask, updateCredits, currentTask]);
};
