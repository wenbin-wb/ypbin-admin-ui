import type { Ref } from 'vue';

import type { AiApi } from '#/api/ai';

import { computed, ref } from 'vue';

import {
  deleteSession,
  getSessionList,
  getSessionMessages,
  toggleSessionPin,
  updateSessionTitle,
} from '#/api/ai';

/**
 * 聊天页的会话域：列表加载/选中/删除/置顶/重命名与相关派生状态。
 *
 * 消息列表与流式状态由调用方持有，本组合式函数通过依赖注入读写。
 */
export function useChatSessions(deps: {
  isStreaming: Ref<boolean>;
  messages: Ref<AiApi.ChatMessage[]>;
  scrollToBottom: (force?: boolean) => void;
}) {
  const sessions = ref<AiApi.ChatSession[]>([]);
  const activeSessionId = ref('');
  const sessionsLoading = ref(false);
  const messagesLoading = ref(false);
  const sessionSearch = ref('');

  async function loadSessions() {
    sessionsLoading.value = true;
    try {
      sessions.value = await getSessionList();
    } finally {
      sessionsLoading.value = false;
    }
  }

  function resetToNewSession() {
    activeSessionId.value = '';
    deps.messages.value = [];
  }

  async function selectSession(id: string) {
    if (deps.isStreaming.value || activeSessionId.value === id) return;
    activeSessionId.value = id;
    deps.messages.value = [];
    messagesLoading.value = true;
    try {
      deps.messages.value = await getSessionMessages(id);
    } catch (error) {
      console.error('Failed to load session messages:', error);
      deps.messages.value = [];
    } finally {
      messagesLoading.value = false;
    }
    await deps.scrollToBottom(true);
  }

  async function handleDeleteSession(id: string) {
    try {
      await deleteSession(id);
      sessions.value = sessions.value.filter((s) => s.id !== id);
      if (activeSessionId.value === id) {
        resetToNewSession();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }

  async function handlePinSession(id: string) {
    try {
      await toggleSessionPin(id);
      // 本地切换置顶状态，不重载消息
      const session = sessions.value.find((s) => s.id === id);
      if (session) session.isPinned = session.isPinned === 1 ? 0 : 1;
      // 排序：置顶的浮到顶
      sessions.value = [
        ...sessions.value.filter((s) => s.isPinned === 1),
        ...sessions.value.filter((s) => s.isPinned !== 1),
      ];
    } catch (error) {
      console.error('Failed to toggle session pin:', error);
    }
  }

  /** 重命名 */
  function startRename(id: string, title: string) {
    const t = title.trim();
    if (!t) return;
    void updateSessionTitle(id, t)
      .then(() => {
        const session = sessions.value.find((s) => s.id === id);
        if (session) session.title = t;
      })
      .catch((error) => {
        console.error('Failed to rename session:', error);
      });
  }

  const activeTitle = computed(
    () =>
      sessions.value.find((s) => s.id === activeSessionId.value)?.title ?? '',
  );

  /** 真欢迎页：没有选中任何会话 */
  const welcomeShown = computed(
    () =>
      !activeSessionId.value &&
      deps.messages.value.length === 0 &&
      !messagesLoading.value,
  );

  /** 空会话提示：选了会话但尚无消息（新建后还没发送） */
  const emptySessionShown = computed(
    () =>
      !!activeSessionId.value &&
      deps.messages.value.length === 0 &&
      !messagesLoading.value,
  );

  return {
    activeSessionId,
    activeTitle,
    emptySessionShown,
    handleDeleteSession,
    handlePinSession,
    loadSessions,
    messagesLoading,
    resetToNewSession,
    selectSession,
    sessionSearch,
    sessions,
    sessionsLoading,
    startRename,
    welcomeShown,
  };
}
