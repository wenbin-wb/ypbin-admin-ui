<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { nextTick, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { marked } from 'marked';

import {
  chat,
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  renameConversation,
} from '#/api/ai';
import { $t } from '#/locales';

defineOptions({ name: 'AiChat' });

// marked + highlight.js 全局配置（模块级只执行一次）
const markdownRenderer = new marked.Renderer();
markdownRenderer.code = ({ text, lang }: { lang?: string; text: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre class="ai-code-block"><code class="hljs language-${language}">${highlighted}</code><button type="button" class="ai-copy-btn">${$t('page.ai.chat.copy')}</button></pre>`;
};
marked.use({ breaks: true, gfm: true, renderer: markdownRenderer });

// ===== 状态 =====
const conversations = ref<AiApi.Conversation[]>([]);
const activeConvId = ref<string>('');
const messages = ref<AiApi.Message[]>([]);
const inputText = ref('');
const isStreaming = ref(false);
const msgListRef = ref<HTMLElement>();
let abortController: AbortController | null = null;

// ===== 会话 =====
async function loadConversations() {
  conversations.value = await listConversations();
}

async function handleNewChat() {
  const conv = await createConversation();
  conversations.value.unshift(conv);
  await selectConversation(conv.id);
}

async function selectConversation(id: string) {
  if (!id) return;
  activeConvId.value = id;
  const data = await listMessages(id, { page: 1, pageSize: 100 });
  messages.value = data.items ?? [];
  await scrollToBottom();
}

async function handleDeleteConv(id: string) {
  await deleteConversation(id);
  conversations.value = conversations.value.filter((c) => c.id !== id);
  if (activeConvId.value === id) {
    activeConvId.value = '';
    messages.value = [];
  }
}

// ===== 发送消息（流式 + AbortController）=====
async function handleSendWithStream() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value) return;

  if (!activeConvId.value) {
    const conv = await createConversation();
    conversations.value.unshift(conv);
    activeConvId.value = conv.id;
  }

  messages.value.push({
    conversationId: activeConvId.value,
    content: text,
    createTime: new Date().toISOString(),
    id: Date.now().toString(),
    role: 'user',
    tokens: 0,
  });
  inputText.value = '';
  await scrollToBottom();

  const assistantMsg: AiApi.Message = {
    conversationId: activeConvId.value,
    content: '',
    createTime: new Date().toISOString(),
    id: 'streaming',
    role: 'assistant',
    tokens: 0,
  };
  messages.value.push(assistantMsg);
  isStreaming.value = true;

  abortController = new AbortController();

  try {
    await chat(
      { conversationId: activeConvId.value, message: text },
      (token: string) => {
        assistantMsg.content += token;
        scrollToBottom();
      },
      async () => {
        isStreaming.value = false;
        abortController = null;
        assistantMsg.id = Date.now().toString();
        await loadConversations();
      },
      abortController.signal,
    );
  } catch (error: unknown) {
    // AbortError 是用户主动中断，不报错
    if (!(error instanceof Error && error.name === 'AbortError')) {
      assistantMsg.content =
        assistantMsg.content || $t('page.ai.chat.requestError');
    }
    isStreaming.value = false;
    abortController = null;
  }
}

function handleStop() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  isStreaming.value = false;
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendWithStream();
  }
}

async function scrollToBottom() {
  await nextTick();
  if (msgListRef.value) {
    msgListRef.value.scrollTop = msgListRef.value.scrollHeight;
  }
}

// ===== 重命名 =====
const renaming = ref<string>('');
const renameTitle = ref('');
function startRename(conv: AiApi.Conversation) {
  renaming.value = conv.id;
  renameTitle.value = conv.title;
}
async function commitRename(id: string) {
  if (!renameTitle.value.trim()) return;
  await renameConversation(id, renameTitle.value);
  const conv = conversations.value.find((c) => c.id === id);
  if (conv) conv.title = renameTitle.value;
  renaming.value = '';
}

// ===== Markdown 渲染（DOMPurify 消毒，防 XSS）=====
function renderMd(content: string): string {
  if (!content) return '';
  try {
    const raw = marked.parse(content) as string;
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['class'] });
  } catch {
    // 渲染失败兜底为纯文本
    return content
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }
}

/** 复制代码块：事件委托处理 .ai-copy-btn 点击 */
function handleMarkdownClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.ai-copy-btn');
  if (!target) return;
  const code = target.previousElementSibling?.textContent ?? '';
  navigator.clipboard.writeText(code);
}

onMounted(async () => {
  await loadConversations();
  if (conversations.value.length > 0) {
    await selectConversation(conversations.value[0]?.id ?? '');
  }
});
</script>

<template>
  <Page auto-content-height class="ai-chat-page">
    <div class="ai-chat-layout">
      <!-- 左侧会话列表 -->
      <div class="ai-chat-sidebar">
        <div class="ai-chat-sidebar__header">
          <span class="ai-chat-sidebar__title">{{
            $t('page.ai.chat.title')
          }}</span>
          <a-button size="small" type="primary" @click="handleNewChat">
            + {{ $t('page.ai.chat.newChat') }}
          </a-button>
        </div>
        <div class="ai-chat-sidebar__list">
          <div
            v-for="conv in conversations"
            :key="conv.id"
            class="ai-chat-conv-item"
            :class="{ active: conv.id === activeConvId }"
            @click="selectConversation(conv.id)"
          >
            <template v-if="renaming === conv.id">
              <a-input
                v-model:value="renameTitle"
                size="small"
                @blur="commitRename(conv.id)"
                @press-enter="commitRename(conv.id)"
              />
            </template>
            <template v-else>
              <span class="ai-chat-conv-item__title">{{ conv.title }}</span>
              <span class="ai-chat-conv-item__actions">
                <a-button
                  size="small"
                  type="text"
                  :title="$t('page.ai.chat.renameConv')"
                  @click.stop="startRename(conv)"
                >
                  ✏️
                </a-button>
                <a-popconfirm
                  :title="$t('page.ai.chat.confirmDelete')"
                  @click.stop
                  @confirm="handleDeleteConv(conv.id)"
                >
                  <a-button size="small" danger type="text">🗑</a-button>
                </a-popconfirm>
              </span>
            </template>
          </div>
        </div>
      </div>

      <!-- 右侧对话区 -->
      <div class="ai-chat-main">
        <div ref="msgListRef" class="ai-chat-messages">
          <div v-if="messages.length === 0" class="ai-chat-empty">
            {{ $t('page.ai.chat.emptyHint') }}
          </div>

          <div
            v-for="msg in messages"
            :key="msg.id"
            class="ai-chat-msg"
            :class="`ai-chat-msg--${msg.role}`"
          >
            <template v-if="msg.role === 'user'">
              <div class="ai-chat-msg__bubble ai-chat-msg__bubble--user">
                <span>{{ msg.content }}</span>
              </div>
            </template>
            <template v-else>
              <div class="ai-chat-msg__avatar">🤖</div>
              <div class="ai-chat-msg__bubble ai-chat-msg__bubble--assistant">
                <!-- eslint-disable vue/no-v-html -->
                <div
                  v-if="msg.content"
                  class="ai-chat-markdown"
                  v-html="renderMd(msg.content)"
                  @click="handleMarkdownClick"
                ></div>
                <!-- eslint-enable vue/no-v-html -->
                <span v-else class="ai-chat-thinking">{{
                  $t('page.ai.chat.thinking')
                }}</span>
              </div>
            </template>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="ai-chat-input-area">
          <a-textarea
            v-model:value="inputText"
            :auto-size="{ maxRows: 6, minRows: 2 }"
            :disabled="isStreaming"
            :placeholder="$t('page.ai.chat.placeholder')"
            @keydown="handleKeydown"
          />
          <div class="ai-chat-input-actions">
            <a-button
              v-if="!isStreaming"
              :disabled="!inputText.trim()"
              type="primary"
              @click="handleSendWithStream"
            >
              {{ $t('page.ai.chat.send') }}
            </a-button>
            <a-button v-else danger @click="handleStop">
              {{ $t('page.ai.chat.stop') }}
            </a-button>
          </div>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.ai-chat-page {
  overflow: hidden;
}

.ai-chat-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.ai-chat-sidebar {
  display: flex;
  flex-direction: column;
  width: 240px;
  min-width: 200px;
  border-right: 1px solid hsl(var(--border));
}

.ai-chat-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  font-weight: 600;
  border-bottom: 1px solid hsl(var(--border));
}

.ai-chat-sidebar__list {
  flex: 1;
  padding: 8px 0;
  overflow-y: auto;
}

.ai-chat-conv-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin: 2px 6px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
}

.ai-chat-conv-item:hover {
  background: hsl(var(--muted));
}

.ai-chat-conv-item.active {
  background: hsl(var(--accent));
}

.ai-chat-conv-item__title {
  flex: 1;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chat-conv-item__actions {
  display: flex;
  gap: 2px;
  opacity: 0;
}

.ai-chat-conv-item:hover .ai-chat-conv-item__actions {
  opacity: 1;
}

.ai-chat-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.ai-chat-messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  overflow-y: auto;
}

.ai-chat-empty {
  margin: auto;
  font-size: 15px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.ai-chat-msg {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  max-width: 82%;
}

.ai-chat-msg--user {
  flex-direction: row-reverse;
  align-self: flex-end;
}

.ai-chat-msg--assistant {
  align-self: flex-start;
}

.ai-chat-msg__avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 16px;
  background: hsl(var(--accent));
  border-radius: 50%;
}

.ai-chat-msg__bubble {
  max-width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-all;
  border-radius: 12px;
}

.ai-chat-msg__bubble--user {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
}

.ai-chat-msg__bubble--assistant {
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
}

.ai-chat-thinking {
  color: hsl(var(--muted-foreground));
  animation: blink 1s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

/* Markdown 渲染 */
.ai-chat-markdown :deep(p) {
  margin: 0 0 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.ai-chat-markdown :deep(h1),
.ai-chat-markdown :deep(h2),
.ai-chat-markdown :deep(h3) {
  margin: 12px 0 6px;
  font-weight: 600;
}

.ai-chat-markdown :deep(ul),
.ai-chat-markdown :deep(ol) {
  padding-left: 20px;
  margin: 6px 0;
}

.ai-chat-markdown :deep(li) {
  margin: 2px 0;
}

.ai-chat-markdown :deep(blockquote) {
  padding-left: 10px;
  margin: 8px 0;
  color: hsl(var(--muted-foreground));
  border-left: 3px solid hsl(var(--primary));
}

.ai-chat-markdown :deep(.ai-code-block) {
  position: relative;
  margin: 8px 0;
  overflow-x: auto;
  background: hsl(var(--secondary));
  border-radius: 6px;
}

.ai-chat-markdown :deep(.ai-code-block code) {
  display: block;
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.ai-chat-markdown :deep(.ai-copy-btn) {
  position: absolute;
  top: 6px;
  right: 8px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.ai-chat-markdown :deep(.ai-code-block:hover .ai-copy-btn) {
  opacity: 1;
}

.ai-chat-markdown :deep(code:not(.hljs)) {
  padding: 2px 5px;
  font-size: 13px;
  background: hsl(var(--secondary));
  border-radius: 3px;
}

.ai-chat-markdown :deep(table) {
  width: 100%;
  margin: 8px 0;
  font-size: 13px;
  border-collapse: collapse;
}

.ai-chat-markdown :deep(th),
.ai-chat-markdown :deep(td) {
  padding: 6px 10px;
  text-align: left;
  border: 1px solid hsl(var(--border));
}

.ai-chat-markdown :deep(th) {
  background: hsl(var(--secondary));
}

.ai-chat-input-area {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 12px 16px;
  border-top: 1px solid hsl(var(--border));
}

.ai-chat-input-area .ant-input {
  flex: 1;
}

.ai-chat-input-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
