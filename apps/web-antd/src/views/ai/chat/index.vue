<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, nextTick, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus, RotateCw, Square } from '@vben/icons';

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

// ===== marked + highlight.js（模块级配置一次）=====
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
const showSidebar = ref(true);
const msgListRef = ref<HTMLElement>();
let abortController: AbortController | null = null;

// 模型选择（新建会话时生效）
const modelId = ref<string>('');

// ===== 会话 =====
async function loadConversations() {
  conversations.value = await listConversations();
}

async function handleNewChat() {
  const conv = await createConversation(modelId.value || undefined);
  conversations.value.unshift(conv);
  await selectConversation(conv.id);
}

async function selectConversation(id: string) {
  if (!id || id === activeConvId.value) return;
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
    const conv = await createConversation(modelId.value || undefined);
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

// ===== 消息操作 =====
async function copyMessage(content: string) {
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    // 忽略剪贴板失败
  }
}

/** 重新生成：删除最后一条助手消息，重发最后一条用户消息 */
async function regenerate() {
  if (isStreaming.value) return;
  const lastUser = [...messages.value].reverse().find((m) => m.role === 'user');
  if (!lastUser) return;
  // 移除最后的助手回复（若有）
  while (messages.value.length > 0) {
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      messages.value.pop();
    } else {
      break;
    }
  }
  await scrollToBottom();
  await handleSendWithStream();
}

// ===== Markdown 渲染（DOMPurify 消毒）=====
function renderMd(content: string): string {
  if (!content) return '';
  try {
    const raw = marked.parse(content) as string;
    return DOMPurify.sanitize(raw, { ADD_ATTR: ['class'] });
  } catch {
    return content
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }
}

function handleMarkdownClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.ai-copy-btn');
  if (!target) return;
  const code = target.previousElementSibling?.textContent ?? '';
  navigator.clipboard.writeText(code);
}

// ===== 当前会话标题 =====
const activeTitle = computed(() => {
  const conv = conversations.value.find((c) => c.id === activeConvId.value);
  return conv?.title ?? $t('page.ai.chat.title');
});

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
      <!-- ===== 左侧会话栏 ===== -->
      <aside v-show="showSidebar" class="ai-chat-sidebar">
        <div class="ai-chat-sidebar__header">
          <span class="ai-chat-sidebar__title">{{
            $t('page.ai.chat.history')
          }}</span>
          <a-button
            type="primary"
            size="small"
            @click="handleNewChat"
          >
            <Plus class="size-4" />
            {{ $t('page.ai.chat.newChat') }}
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
      </aside>

      <!-- ===== 主对话区 ===== -->
      <main class="ai-chat-main">
        <!-- 顶部工具栏 -->
        <header class="ai-chat-topbar">
          <a-button
            class="ai-chat-topbar__toggle"
            size="small"
            type="text"
            @click="showSidebar = !showSidebar"
          >
            ☰
          </a-button>
          <span class="ai-chat-topbar__title">{{ activeTitle }}</span>
          <div class="ai-chat-topbar__actions">
            <a-select
              v-model:value="modelId"
              :placeholder="$t('page.ai.chat.selectModel')"
              class="ai-chat-topbar__model"
              size="small"
              allow-clear
            >
              <a-select-option value="deepseek-v4-flash">
                DeepSeek V4 Flash
              </a-select-option>
              <a-select-option value="deepseek-v4-pro">
                DeepSeek V4 Pro
              </a-select-option>
            </a-select>
          </div>
        </header>

        <!-- 欢迎页（无消息时） -->
        <div v-if="messages.length === 0" class="ai-chat-welcome">
          <div class="ai-chat-welcome__logo">🤖</div>
          <h1 class="ai-chat-welcome__title">
            {{ $t('page.ai.chat.welcomeTitle') }}
          </h1>
          <p class="ai-chat-welcome__desc">
            {{ $t('page.ai.chat.emptyHint') }}
          </p>
        </div>

        <!-- 消息流 -->
        <div v-else ref="msgListRef" class="ai-chat-messages">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="ai-chat-msg"
            :class="`ai-chat-msg--${msg.role}`"
          >
            <template v-if="msg.role === 'user'">
              <div class="ai-chat-msg__bubble ai-chat-msg__bubble--user">
                <span class="ai-chat-msg__content">{{ msg.content }}</span>
              </div>
            </template>
            <template v-else>
              <div class="ai-chat-msg__avatar">🤖</div>
              <div class="ai-chat-msg__body">
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
                <div class="ai-chat-msg__actions">
                  <a-button
                    size="small"
                    type="text"
                    :title="$t('page.ai.chat.copy')"
                    @click="copyMessage(msg.content)"
                  >
                    📋
                  </a-button>
                  <a-button
                    size="small"
                    type="text"
                    :title="$t('page.ai.chat.regenerate')"
                    @click="regenerate"
                  >
                    <RotateCw class="size-4" />
                  </a-button>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 底部输入区 -->
        <div class="ai-chat-input-area">
          <div class="ai-chat-input-box">
            <a-textarea
              v-model:value="inputText"
              :auto-size="{ maxRows: 10, minRows: 1 }"
              :disabled="isStreaming"
              :placeholder="$t('page.ai.chat.placeholder')"
              class="ai-chat-input-box__textarea"
              @keydown="handleKeydown"
            />
            <div class="ai-chat-input-box__actions">
              <span class="ai-chat-input-box__tip">{{
                $t('page.ai.chat.enterTip')
              }}</span>
              <a-button
                v-if="!isStreaming"
                :disabled="!inputText.trim()"
                shape="circle"
                type="primary"
                @click="handleSendWithStream"
              >
                <svg
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </a-button>
              <a-button v-else danger shape="circle" @click="handleStop">
                <Square class="size-4" />
              </a-button>
            </div>
          </div>
        </div>
      </main>
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
}

/* ===== 左侧会话栏 ===== */
.ai-chat-sidebar {
  display: flex;
  flex-direction: column;
  width: 260px;
  min-width: 220px;
  background: hsl(var(--muted) / 35%);
  border-right: 1px solid hsl(var(--border));
}

.ai-chat-sidebar__header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid hsl(var(--border));
}

.ai-chat-sidebar__title {
  font-size: 15px;
  font-weight: 600;
}

.ai-chat-sidebar__list {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.ai-chat-conv-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 10px;
  margin-bottom: 2px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}

.ai-chat-conv-item:hover {
  background: hsl(var(--accent));
}

.ai-chat-conv-item.active {
  background: hsl(var(--primary) / 12%);
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

/* ===== 主区 ===== */
.ai-chat-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

/* 顶栏 */
.ai-chat-topbar {
  display: flex;
  gap: 12px;
  align-items: center;
  height: 52px;
  padding: 0 20px;
  border-bottom: 1px solid hsl(var(--border));
}

.ai-chat-topbar__toggle {
  font-size: 16px;
}

.ai-chat-topbar__title {
  flex: 1;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-chat-topbar__model {
  width: 180px;
}

/* 欢迎页 */
.ai-chat-welcome {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.ai-chat-welcome__logo {
  font-size: 56px;
}

.ai-chat-welcome__title {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.ai-chat-welcome__desc {
  margin: 0;
  font-size: 14px;
  color: hsl(var(--muted-foreground));
}

/* 消息流 */
.ai-chat-messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 24px;
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px;
  overflow-y: auto;
}

.ai-chat-msg {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.ai-chat-msg--user {
  justify-content: flex-end;
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
  border-radius: 8px;
}

.ai-chat-msg__body {
  max-width: calc(100% - 44px);
}

.ai-chat-msg__bubble {
  padding: 2px 2px;
  font-size: 14px;
  line-height: 1.75;
  word-break: break-word;
}

.ai-chat-msg__bubble--user {
  max-width: 70%;
  padding: 10px 16px;
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
  border-radius: 12px;
  border-bottom-right-radius: 4px;
}

.ai-chat-msg__bubble--assistant {
  background: transparent;
}

.ai-chat-msg__content {
  white-space: pre-wrap;
}

.ai-chat-msg__actions {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.ai-chat-msg:hover .ai-chat-msg__actions {
  opacity: 1;
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

/* ===== 底部输入区 ===== */
.ai-chat-input-area {
  padding: 12px 24px 20px;
  border-top: 1px solid hsl(var(--border));
}

.ai-chat-input-box {
  max-width: 860px;
  margin: 0 auto;
  padding: 10px 10px 8px 16px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  box-shadow: 0 2px 16px hsl(var(--foreground) / 8%);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.ai-chat-input-box:focus-within {
  border-color: hsl(var(--primary) / 50%);
  box-shadow: 0 4px 24px hsl(var(--primary) / 14%);
}

.ai-chat-input-box__textarea {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  resize: none;
}

.ai-chat-input-box__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 6px;
}

.ai-chat-input-box__tip {
  margin-right: auto;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

/* ===== Markdown ===== */
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
  border-radius: 8px;
}

.ai-chat-markdown :deep(.ai-code-block code) {
  display: block;
  padding: 12px;
  font-size: 13px;
  line-height: 1.6;
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
</style>
