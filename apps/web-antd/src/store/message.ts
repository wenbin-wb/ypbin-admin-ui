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

  async function refresh() {
    try {
      const [messages, count] = await Promise.all([
        getRecentMessages(10),
        getUnreadCount(),
      ]);
      recentMessages.value = messages;
      unreadCount.value = count;
    } catch (error) {
      console.error('Failed to refresh messages:', error);
      throw error;
    }
  }

  function updateRecentMessage(id: string, readStatus: number) {
    recentMessages.value = recentMessages.value.map((message) =>
      message.id === id ? { ...message, readStatus } : message,
    );
  }

  async function markRead(id: string) {
    await markMessageRead(id);
    const message = recentMessages.value.find((item) => item.id === id);
    if (message?.readStatus === 0) {
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
    updateRecentMessage(id, 1);
    await refresh();
  }

  async function markAllRead() {
    await markAllMessagesRead();
    unreadCount.value = 0;
    recentMessages.value = recentMessages.value.map((message) => ({
      ...message,
      readStatus: 1,
    }));
    await refresh();
  }

  async function remove(id: string) {
    await deleteMessage(id);
    const message = recentMessages.value.find((item) => item.id === id);
    if (message?.readStatus === 0) {
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
    recentMessages.value = recentMessages.value.filter(
      (message) => message.id !== id,
    );
    await refresh();
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
        `${apiURL}/ypbin/sse/subscribe?ticket=${ticket}`,
      );
      eventSource = source;

      source.addEventListener('open', () => {
        retryCount = 0;
      });
      source.addEventListener('message-unread', () => {
        void refresh().catch((error) => {
          console.error('Failed to refresh messages after SSE event:', error);
        });
      });
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
