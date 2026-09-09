import type { NotificationItem } from '@vben/layouts';

import type { SystemMessageApi } from '#/api/system/message';

import { computed, ref } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useUserStore } from '@vben/stores';

import { defineStore } from 'pinia';

import {
  deleteMessage,
  getMessageList,
  getRecentMessages,
  getSseTicket,
  getUnreadCount,
  markAllMessagesRead,
  markMessageRead,
} from '#/api/system/message';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

const MAX_RETRY_DELAY = 30_000;

function toNotification(
  message: SystemMessageApi.MessageItem,
): NotificationItem {
  return {
    avatar: '',
    date: message.createTime,
    id: message.id,
    isRead: message.readStatus === 1,
    message: message.content.replaceAll(/<[^>]+>/g, '').slice(0, 60),
    title: message.title,
  };
}

export const useMessageStore = defineStore('message', () => {
  const userStore = useUserStore();
  const recentMessages = ref<SystemMessageApi.MessageItem[]>([]);
  const unreadCount = ref(0);
  const notifications = computed(() =>
    recentMessages.value.map(toNotification),
  );

  let eventSource: EventSource | null = null;
  let reconnectTimer: null | ReturnType<typeof setTimeout> = null;
  let retryCount = 0;
  let sseEnabled = false;
  let sseInitializing = false;
  let sseVersion = 0;
  // 递增版本号：refresh() 的响应仅在该次调用仍是最新版本时应用，
  // 防止 markRead/markAllRead/remove 乐观更新后发起的 refresh 与
  // SSE message-unread 触发的 refresh 并发时，旧响应覆盖新状态。
  let refreshVersion = 0;
  // 本地写动作（已读/删除）进行中的深度：期间 SSE 拉取的快照可能早于写动作的
  // 服务端提交，直接应用会把刚处理过的条目“回跳”成旧状态，因此只记待补、不立即拉取。
  let localMutationDepth = 0;
  let pendingSseRefresh = false;

  /** SSE 收到未读事件后的刷新入口：本地写动作期间延迟到动作结束后统一补拉一次 */
  function refreshFromSseEvent() {
    if (localMutationDepth > 0) {
      pendingSseRefresh = true;
      return;
    }
    void refresh().catch((error) => {
      console.error('Failed to refresh messages after SSE event:', error);
    });
  }

  /**
   * 在本地写动作期间执行 action（含动作自身的收尾 refresh）。
   * 动作结束后若期间收到过 SSE 事件，则补拉一次，避免动作窗口内的新消息漏刷。
   */
  async function runLocalMutation<T>(action: () => Promise<T>): Promise<T> {
    localMutationDepth += 1;
    try {
      return await action();
    } finally {
      localMutationDepth = Math.max(0, localMutationDepth - 1);
      if (localMutationDepth === 0 && pendingSseRefresh) {
        pendingSseRefresh = false;
        void refresh().catch((error) => {
          console.error(
            'Failed to refresh messages after local mutation:',
            error,
          );
        });
      }
    }
  }

  async function refresh() {
    const version = ++refreshVersion;
    try {
      const [messages, count] = await Promise.all([
        getRecentMessages(10),
        getUnreadCount(),
      ]);
      if (version !== refreshVersion) {
        // 已有更新的刷新在途/完成，丢弃本次过期结果
        return;
      }
      recentMessages.value = messages;
      unreadCount.value = count;
    } catch (error) {
      if (version !== refreshVersion) {
        return;
      }
      console.error('Failed to refresh messages:', error);
      throw error;
    }
  }

  function updateRecentMessage(id: string, readStatus: number) {
    recentMessages.value = recentMessages.value.map((message) =>
      message.id === id ? { ...message, readStatus } : message,
    );
  }

  function markRead(id: string) {
    return runLocalMutation(async () => {
      await markMessageRead(id);
      const message = recentMessages.value.find((item) => item.id === id);
      if (message?.readStatus === 0) {
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
      updateRecentMessage(id, 1);
      await refresh();
    });
  }

  function markAllRead() {
    return runLocalMutation(async () => {
      await markAllMessagesRead();
      unreadCount.value = 0;
      recentMessages.value = recentMessages.value.map((message) => ({
        ...message,
        readStatus: 1,
      }));
      await refresh();
    });
  }

  function remove(id: string) {
    return runLocalMutation(async () => {
      await deleteMessage(id);
      const message = recentMessages.value.find((item) => item.id === id);
      if (message?.readStatus === 0) {
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
      recentMessages.value = recentMessages.value.filter(
        (message) => message.id !== id,
      );
      await refresh();
    });
  }

  function queryMessages(params: SystemMessageApi.MessageQuery) {
    return getMessageList(params);
  }

  function scheduleReconnect() {
    if (!sseEnabled || reconnectTimer) {
      return;
    }
    const delay = Math.min(1000 * 2 ** retryCount, MAX_RETRY_DELAY);
    retryCount += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connectSse();
    }, delay);
  }

  async function connectSse() {
    if (
      !sseEnabled ||
      !userStore.userInfo?.userId ||
      eventSource ||
      sseInitializing
    ) {
      return;
    }

    const version = sseVersion;
    sseInitializing = true;
    try {
      const { ticket } = await getSseTicket();
      if (!ticket) {
        throw new Error('SSE ticket is missing');
      }
      if (!sseEnabled || version !== sseVersion) {
        return;
      }

      const source = new EventSource(
        `${apiURL}/system/ypbin/sse/subscribe?ticket=${encodeURIComponent(ticket)}`,
      );
      eventSource = source;

      source.addEventListener('open', () => {
        retryCount = 0;
      });
      source.addEventListener('message-unread', refreshFromSseEvent);
      source.addEventListener('error', () => {
        console.error('SSE connection failed; scheduling reconnect.');
        source.close();
        if (eventSource === source) {
          eventSource = null;
        }
        scheduleReconnect();
      });
    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
      scheduleReconnect();
    } finally {
      sseInitializing = false;
    }
  }

  async function startSse() {
    sseEnabled = true;
    await connectSse();
  }

  function closeSse() {
    sseEnabled = false;
    sseVersion += 1;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    eventSource?.close();
    eventSource = null;
    retryCount = 0;
  }

  function $reset() {
    closeSse();
    recentMessages.value = [];
    unreadCount.value = 0;
  }

  return {
    $reset,
    closeSse,
    markAllRead,
    markRead,
    notifications,
    queryMessages,
    recentMessages,
    refresh,
    remove,
    startSse,
    unreadCount,
  };
});
