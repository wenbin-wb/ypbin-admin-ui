<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { nextTick, ref } from 'vue';

import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { marked } from 'marked';

import { chat, createConversation, listMessages } from '#/api/ai';
import { $t } from '#/locales';

defineOptions({ name: 'AiAssistantWidget' });

// marked 渲染
const renderer = new marked.Renderer();
renderer.code = ({ text, lang }: { lang?: string; text: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre class="aiw-code"><code class="hljs language-${language}">${highlighted}</code></pre>`;
};
marked.use({ breaks: true, gfm: true, renderer });

const open = ref(false);
const messages = ref<AiApi.Message[]>([]);
const inputText = ref('');
const isStreaming = ref(false);
const sending = ref(false);
const listRef = ref<HTMLElement>();
const conversationId = ref('');
let abortController: AbortController | null = null;

function renderMd(content: string): string {
  if (!content) return '';
  try {
    const raw = marked.parse(content) as string;
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['class'] });
  } catch {
    return content.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
}

async function scrollToBottom() {
  await nextTick();
  if (listRef.value) {
    listRef.value.scrollTop = listRef.value.scrollHeight;
  }
}

async function toggleOpen() {
  open.value = !open.value;
  if (open.value) {
    await ensureConversation();
    await scrollToBottom();
  }
}

async function ensureConversation() {
  if (conversationId.value) return;
  try {
    const conv = await createConversation();
    conversationId.value = conv.id;
    const data = await listMessages(conv.id, { page: 1, pageSize: 50 });
    messages.value = data.items ?? [];
  } catch {
    // 未登录或接口异常时保持可输入
  }
}

async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value || sending.value) return;
  sending.value = true;
  try {
    await ensureConversation();
    if (!conversationId.value) return;

    messages.value.push({
      conversationId: conversationId.value,
      content: text,
      createTime: new Date().toISOString(),
      id: Date.now().toString(),
      role: 'user',
      tokens: 0,
    });
    inputText.value = '';
    await scrollToBottom();

    const assistantMsg: AiApi.Message = {
      conversationId: conversationId.value,
      content: '',
      createTime: new Date().toISOString(),
      id: 'streaming',
      role: 'assistant',
      tokens: 0,
    };
    messages.value.push(assistantMsg);
    isStreaming.value = true;
    abortController = new AbortController();

    await chat(
      { conversationId: conversationId.value, message: text },
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
    );
  } catch (error: unknown) {
    if (!(error instanceof Error && error.name === 'AbortError')) {
      const last = messages.value[messages.value.length - 1];
      if (last && last.role === 'assistant' && !last.content) {
        last.content = $t('page.ai.chat.requestError');
      }
    }
    isStreaming.value = false;
    abortController = null;
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
</script>

<template>
  <!-- 悬浮入口按钮 -->
  <div class="aiw-fab" :class="{ 'aiw-fab--open': open }" @click="toggleOpen">
    <svg
      v-if="!open"
      class="aiw-fab__icon"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      viewBox="0 0 24 24"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
    </svg>
    <svg
      v-else
      class="aiw-fab__icon"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      viewBox="0 0 24 24"
      stroke-linecap="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  </div>

  <!-- 对话面板 -->
  <Teleport to="body">
    <Transition name="aiw-pop">
      <div v-if="open" class="aiw-panel">
        <div class="aiw-panel__header">
          <span class="aiw-panel__title">
            <svg class="aiw-panel__logo" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
            </svg>
            {{ $t('page.ai.widget.title') }}
          </span>
          <a-button size="small" type="text" @click="open = false">
            <svg class="size-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </a-button>
        </div>

        <div ref="listRef" class="aiw-panel__list">
          <div v-if="messages.length === 0" class="aiw-panel__empty">
            <svg class="aiw-panel__empty-icon" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
            </svg>
            <p>{{ $t('page.ai.widget.hint') }}</p>
          </div>
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="aiw-msg"
            :class="`aiw-msg--${msg.role}`"
          >
            <template v-if="msg.role === 'user'">
              <div class="aiw-msg__bubble aiw-msg__bubble--user">
                {{ msg.content }}
              </div>
            </template>
            <template v-else>
              <!-- eslint-disable vue/no-v-html -->
              <div
                v-if="msg.content"
                class="aiw-msg__markdown"
                v-html="renderMd(msg.content)"
              ></div>
              <!-- eslint-enable vue/no-v-html -->
              <span v-else class="aiw-msg__thinking">{{
                $t('page.ai.chat.thinking')
              }}</span>
            </template>
          </div>
        </div>

        <div class="aiw-panel__input">
          <a-textarea
            v-model:value="inputText"
            :auto-size="{ maxRows: 4, minRows: 1 }"
            :disabled="isStreaming"
            :placeholder="$t('page.ai.widget.placeholder')"
            class="aiw-panel__textarea"
            @keydown="handleKeydown"
          />
          <div class="aiw-panel__actions">
            <a-button
              v-if="!isStreaming"
              :disabled="!inputText.trim()"
              shape="circle"
              size="small"
              type="primary"
              @click="handleSend"
            >
              <svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </a-button>
            <a-button v-else danger shape="circle" size="small" @click="handleStop">
              <svg class="size-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect height="12" width="12" x="6" y="6" />
              </svg>
            </a-button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 悬浮按钮 */
.aiw-fab {
  position: fixed;
  z-index: 1000;
  right: 24px;
  bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  background: hsl(var(--primary));
  border-radius: 50%;
  box-shadow: 0 6px 20px hsl(var(--primary) / 35%);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.aiw-fab:hover {
  transform: scale(1.06);
  box-shadow: 0 8px 24px hsl(var(--primary) / 45%);
}

.aiw-fab__icon {
  width: 22px;
  height: 22px;
}

/* 面板 */
.aiw-panel {
  position: fixed;
  z-index: 1000;
  right: 24px;
  bottom: 84px;
  display: flex;
  flex-direction: column;
  width: 360px;
  height: 520px;
  overflow: hidden;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  box-shadow: 0 16px 48px hsl(var(--foreground) / 18%);
}

.aiw-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 46px;
  padding: 0 12px 0 16px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid hsl(var(--border));
}

.aiw-panel__title {
  display: flex;
  gap: 8px;
  align-items: center;
}

.aiw-panel__logo {
  width: 18px;
  height: 18px;
}

.aiw-panel__list {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
}

.aiw-panel__empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  text-align: center;
}

.aiw-panel__empty-icon {
  width: 40px;
  height: 40px;
  color: hsl(var(--muted-foreground) / 60%);
}

.aiw-msg {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 13px;
  line-height: 1.6;
}

.aiw-msg--user {
  justify-content: flex-end;
}

.aiw-msg__bubble--user {
  max-width: 82%;
  padding: 8px 12px;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-radius: 10px;
  border-bottom-right-radius: 3px;
  white-space: pre-wrap;
  word-break: break-word;
}

.aiw-msg__markdown {
  max-width: 82%;
  padding: 8px 10px;
  background: hsl(var(--muted) / 50%);
  border-radius: 10px;
  border-bottom-left-radius: 3px;
  word-break: break-word;
}

.aiw-msg__markdown :deep(.aiw-code) {
  margin: 6px 0;
  padding: 8px;
  overflow-x: auto;
  font-size: 12px;
  background: hsl(var(--secondary));
  border-radius: 6px;
}

.aiw-msg__thinking {
  color: hsl(var(--muted-foreground));
  animation: aiw-blink 1s infinite;
}

@keyframes aiw-blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

/* 输入区 */
.aiw-panel__input {
  padding: 10px 12px;
  border-top: 1px solid hsl(var(--border));
}

.aiw-panel__textarea {
  border: none !important;
  box-shadow: none !important;
  background: hsl(var(--muted) / 30%) !important;
  border-radius: 8px !important;
  resize: none;
}

.aiw-panel__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* 过渡动画 */
.aiw-pop-enter-active,
.aiw-pop-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.aiw-pop-enter-from,
.aiw-pop-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}
</style>
