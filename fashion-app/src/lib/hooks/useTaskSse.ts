import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/authStore';
import { useNotificationStore } from '@/lib/stores/notificationStore';
import { useTaskStore } from '@/lib/stores/taskStore';

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
 *
 * 防重复通知策略：
 * - SSE 重连时后端可能重新推送已完成任务的状态
 * - notifiedTaskIds 集合确保同一 taskId 的 DONE/FAILED 只弹一次通知
 * - notificationStore 限制同时只显示 1 条通知
 */
export const useTaskSse = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const updateCredits = useAuthStore((state) => state.updateCredits);
  const setCurrentTask = useTaskStore((state) => state.setCurrentTask);
  const addNotification = useNotificationStore((state) => state.add);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const handleSseMessage = (event: MessageEvent<string>) => {
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

        // 发送全局 Toast 通知（带 taskId，由 store 层去重）
        if (status === 'DONE') {
          addNotification({ type: 'success', message: '生图任务已完成，快去查看结果！', taskId });
          // 刷新积分
          import('@/lib/api/workspace').then(({ workspaceApi }) => {
            void workspaceApi.getBalance().then(updateCredits).catch(() => undefined);
          });
        } else if (status === 'FAILED') {
          addNotification({ type: 'error', message: `生图任务失败：${errorMsg ?? '未知错误'}`, taskId });
          import('@/lib/api/workspace').then(({ workspaceApi }) => {
            void workspaceApi.getBalance().then(updateCredits).catch(() => undefined);
          });
        }
      } catch {
        // JSON 解析失败（心跳注释行），忽略
      }
    };

    // 先获取短期 SSE token，再用它建立 EventSource 连接
    const connectSse = async () => {
      try {
        const tokenRes = await fetch(`${API_BASE_URL}/sse/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!tokenRes.ok || cancelled) return;

        const { sseToken } = await tokenRes.json() as { sseToken: string };
        if (cancelled) return;

        // 关闭旧连接
        esRef.current?.close();

        const url = `${API_BASE_URL}/sse/tasks?token=${encodeURIComponent(sseToken)}`;
        const es = new EventSource(url);
        esRef.current = es;

        es.onmessage = handleSseMessage;

        es.onerror = () => {
          // SSE 连接断开（token 过期 / 网络波动），关闭旧连接并延迟重连
          es.close();
          esRef.current = null;
          if (!cancelled) {
            clearReconnectTimer();
            reconnectTimerRef.current = setTimeout(() => {
              if (!cancelled) void connectSse();
            }, 3000);
          }
        };
      } catch {
        // 获取 SSE token 失败，延迟重试
        if (!cancelled) {
          clearReconnectTimer();
          reconnectTimerRef.current = setTimeout(() => {
            if (!cancelled) void connectSse();
          }, 5000);
        }
      }
    };

    connectSse();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      esRef.current?.close();
      esRef.current = null;
    };
  }, [accessToken, addNotification, setCurrentTask, updateCredits]);
};
