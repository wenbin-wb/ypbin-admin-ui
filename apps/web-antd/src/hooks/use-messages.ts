import type { NotificationItem } from '@vben/layouts';

import { onUnmounted, ref } from 'vue';

import { useAppConfig } from '@vben/hooks';
import { useUserStore } from '@vben/stores';

import {
  getRecentMessages,
  getSseTicket,
  getUnreadCount,
  markAllMessagesRead,
  markMessageRead,
} from '#/api/system/message';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

/**
 * 站内信中心 composable：拉取最近消息与未读数，映射为铃铛通知项，
 * 并通过 SSE 实时刷新（收到 message-unread 事件即重拉）。
 *
 * SSE 鉴权走一次性票据：token 在 header、EventSource 无法携带，故先换票再订阅。
 * 票据一次性消费，因此不能用原生 EventSource 的自动重连（会复用已失效的旧票据），
 * 而是自己监听 error 关闭连接、换新票据后重连。
 */
export function useMessages() {
  const userStore = useUserStore();
  const notifications = ref<NotificationItem[]>([]);
  const unreadCount = ref(0);
  // 最近消息完整数据（含富文本 content），供铃铛详情弹窗使用
  const recentMessages = ref<
    { content?: string; createTime?: string; id: string; title?: string }[]
  >([]);

  let eventSource: EventSource | null = null;
  let closedByUs = false;
  let reconnectTimer: null | ReturnType<typeof setTimeout> = null;
  let retryCount = 0;
  const MAX_RETRY_DELAY = 30_000;

  function toNotification(m: {
    content: string;
    createTime: string;
    id: string;
    readStatus: number;
    title: string;
  }): NotificationItem {
    return {
      id: m.id,
      // 站内信无独立头像，不渲染头像区（组件内 v-if="item.avatar" 处理）
      avatar: '',
      date: m.createTime ?? '',
      isRead: m.readStatus === 1,
      message: (m.content ?? '').replaceAll(/<[^>]+>/g, '').slice(0, 60),
      title: m.title ?? '',
    };
  }

  async function refresh() {
    const [list, count] = await Promise.all([
      getRecentMessages(10),
      getUnreadCount(),
    ]);
    recentMessages.value = (list ?? []) as any;
    notifications.value = (list ?? []).map((m) => toNotification(m as any));
    unreadCount.value = count ?? 0;
  }

  async function markRead(id: number | string) {
    await markMessageRead(String(id));
    await refresh();
  }

  async function markAllRead() {
    await markAllMessagesRead();
    await refresh();
  }

  /** 断开当前连接并安排重连（指数退避），换新票据后再建 */
  function scheduleReconnect() {
    if (closedByUs || reconnectTimer) {
      return;
    }
    const delay = Math.min(1000 * 2 ** retryCount, MAX_RETRY_DELAY);
    retryCount += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectSse();
    }, delay);
  }

  /**
   * 建立 SSE 长连接：先换一次性票据，再用票据订阅。
   * error 时主动关闭并换新票据重连（票据一次性，不能靠 EventSource 自动重连）。
   */
  async function connectSse() {
    if (!userStore.userInfo?.userId || eventSource) {
      return;
    }
    closedByUs = false;
    // 换票失败要暴露出来，不静默吞
    const { ticket } = await getSseTicket();
    if (!ticket) {
      throw new Error('SSE 换票失败：未拿到 ticket');
    }
    const source = new EventSource(
      `${apiURL}/ypbin/sse/subscribe?ticket=${ticket}`,
    );
    eventSource = source;

    source.addEventListener('open', () => {
      retryCount = 0; // 连接成功，重置退避
    });
    source.addEventListener('message-unread', () => {
      refresh();
    });
    source.addEventListener('error', () => {
      // 原生 EventSource 出错会用旧票据重连、必失败；这里主动关闭改为换新票据重连
      source.close();
      if (eventSource === source) {
        eventSource = null;
      }
      scheduleReconnect();
    });
  }

  function closeSse() {
    closedByUs = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    eventSource?.close();
    eventSource = null;
    retryCount = 0;
  }

  onUnmounted(closeSse);

  return {
    notifications,
    recentMessages,
    unreadCount,
    refresh,
    markRead,
    markAllRead,
    connectSse,
    closeSse,
  };
}
