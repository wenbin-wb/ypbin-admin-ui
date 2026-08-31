import type { AiApi } from '#/api/ai';

import { computed, nextTick, onUnmounted, reactive, ref } from 'vue';

import { chat, createSession, getSessionMessages } from '#/api/ai';
import { $t } from '#/locales';

/**
 * AI 悬浮助手的会话与流式对话状态。
 *
 * 封装会话懒创建、历史回填、流式收发与中止；窗口定位见 use-widget-window。
 */
export function useAssistantChat() {
  const messages = ref<AiApi.ChatMessage[]>([]);
  const inputText = ref('');
  const isStreaming = ref(false);
  const sending = ref(false);
  const listRef = ref<HTMLElement | null>(null);
  const sessionId = ref('');
  let abortController: AbortController | null = null;

  async function scrollToBottom() {
    await nextTick();
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight;
    }
  }

  async function handleNewChat() {
    if (isStreaming.value) {
      handleStop();
    }
    try {
      sessionId.value = await createSession();
      messages.value = [];
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  }

  async function ensureSession() {
    if (sessionId.value) return;
    try {
      sessionId.value = await createSession();
      const history = await getSessionMessages(sessionId.value);
      messages.value = history ?? [];
    } catch (error) {
      console.error('Failed to initialize assistant widget session:', error);
    }
  }

  async function handleSend(customText?: string) {
    const text = (customText ?? inputText.value).trim();
    if (!text || isStreaming.value || sending.value) return;
    sending.value = true;
    try {
      if (!sessionId.value) {
        sessionId.value = await createSession();
      }

      messages.value.push({
        content: text,
        createTime: new Date().toISOString(),
        id: Date.now().toString(),
        role: 'user',
      });
      if (!customText) {
        inputText.value = '';
      }
      await scrollToBottom();

      const assistantMsg = reactive<AiApi.ChatMessage>({
        content: '',
        createTime: new Date().toISOString(),
        id: 'streaming',
        role: 'assistant',
      });
      messages.value.push(assistantMsg);
      isStreaming.value = true;
      abortController = new AbortController();

      await chat(
        { content: text, sessionId: sessionId.value },
        (token: string) => {
          assistantMsg.content += token;
          scrollToBottom();
        },
        () => {
          isStreaming.value = false;
          abortController = null;
          assistantMsg.id = Date.now().toString();
        },
        abortController.signal,
        (error: Error) => {
          assistantMsg.content =
            error.message || $t('page.ai.chat.requestError');
          isStreaming.value = false;
          abortController = null;
          assistantMsg.id = Date.now().toString();
        },
      );
    } catch (error: unknown) {
      console.error('Failed to send assistant widget message:', error);
      if (!(error instanceof Error && error.name === 'AbortError')) {
        const last = messages.value[messages.value.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          last.content = $t('page.ai.chat.requestError');
        }
      }
      isStreaming.value = false;
      abortController = null;
      const streaming = messages.value[messages.value.length - 1];
      if (streaming?.id === 'streaming') {
        streaming.id = Date.now().toString();
      }
    } finally {
      sending.value = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleStop() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    isStreaming.value = false;
  }

  const quickPrompts = computed(() => [
    $t('page.ai.widget.quick_1'),
    $t('page.ai.widget.quick_2'),
    $t('page.ai.widget.quick_3'),
  ]);

  onUnmounted(() => {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  });

  return {
    ensureSession,
    handleKeydown,
    handleNewChat,
    handleSend,
    handleStop,
    inputText,
    isStreaming,
    listRef,
    messages,
    quickPrompts,
    scrollToBottom,
    sending,
  };
}
