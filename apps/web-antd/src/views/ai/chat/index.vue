<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, nextTick, onMounted, ref } from 'vue';

import { Copy, Menu, Plus, RotateCw, Square, X } from '@vben/icons';

import { Button, Input, Popconfirm, Select } from 'ant-design-vue';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import { marked } from 'marked';

import {
  chat,
  createConversation,
  deleteConversation,
  listConversations,
  listKnowledgeBases,
  listMessages,
  renameConversation,
} from '#/api/ai';
import { $t } from '#/locales';

defineOptions({ name: 'AiChat' });

// ===== marked + highlight.js =====
const markdownRenderer = new marked.Renderer();
markdownRenderer.code = ({ text, lang }: { lang?: string; text: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre class="ai-code-block"><code class="hljs language-${language}">${highlighted}</code><button type="button" class="ai-copy-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>${$t('page.ai.chat.copy')}</button></pre>`;
};
marked.use({ breaks: true, gfm: true, renderer: markdownRenderer });

// ===== 状态 =====
const conversations = ref<AiApi.Conversation[]>([]);
const activeConvId = ref<string>('');
const messages = ref<AiApi.Message[]>([]);
const inputText = ref('');
const isStreaming = ref(false);
const drawerOpen = ref(false);
const knowledgeBases = ref<AiApi.KnowledgeBase[]>([]);
const knowledgeBaseId = ref<string>('');
const msgListRef = ref<HTMLElement>();
let abortController: AbortController | null = null;

// ===== 会话 =====
async function loadConversations() {
  conversations.value = await listConversations();
}

async function handleNewChat() {
  drawerOpen.value = false;
  const conv = await createConversation();
  conversations.value.unshift(conv);
  await selectConversation(conv.id);
}

async function selectConversation(id: string) {
  if (!id || id === activeConvId.value) return;
  activeConvId.value = id;
  drawerOpen.value = false;
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

// ===== 发送（流式）=====
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
      {
        conversationId: activeConvId.value,
        knowledgeBaseId: knowledgeBaseId.value || undefined,
        message: text,
      },
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
const liked = ref<Record<string, 'down' | 'up' | undefined>>({});

async function copyMessage(content: string) {
  try {
    await navigator.clipboard.writeText(content);
  } catch {
    // 忽略剪贴板失败
  }
}

function toggleLike(id: string, type: 'down' | 'up') {
  liked.value[id] = liked.value[id] === type ? undefined : type;
}

/** 重新生成：删除尾部助手回复，重发最后一条用户消息 */
async function regenerate() {
  if (isStreaming.value) return;
  const lastUser = [...messages.value]
    .toReversed()
    .find((m) => m.role === 'user');
  if (!lastUser) return;
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

// ===== Markdown 渲染 =====
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

const activeTitle = computed(() => {
  const conv = conversations.value.find((c) => c.id === activeConvId.value);
  return conv?.title ?? '';
});

onMounted(async () => {
  await loadConversations();
  if (conversations.value.length > 0) {
    await selectConversation(conversations.value[0]?.id ?? '');
  }
  try {
    knowledgeBases.value = await listKnowledgeBases();
  } catch {
    // 知识库不可用时仅隐藏关联选择
  }
});
</script>

<template>
  <div class="ds-chat">
    <!-- ===== 顶部栏 ===== -->
    <header class="ds-chat__topbar">
      <div class="ds-chat__topbar-inner">
        <button class="ds-chat__menu-btn" @click="drawerOpen = true">
          <Menu class="size-5" />
        </button>
        <span class="ds-chat__brand">Ypbin AI</span>
        <span v-if="activeTitle" class="ds-chat__title">{{ activeTitle }}</span>
      </div>
    </header>

    <!-- ===== 会话抽屉（页面内覆盖，不遮挡全局菜单）===== -->
    <Transition name="ds-drawer">
      <div v-if="drawerOpen" class="ds-drawer">
        <div class="ds-drawer__mask" @click="drawerOpen = false"></div>
        <aside class="ds-drawer__panel">
          <div class="ds-drawer__header">
            <button class="ds-chat__menu-btn" @click="drawerOpen = false">
              <X class="size-5" />
            </button>
            <span class="ds-chat__brand">Ypbin AI</span>
          </div>
          <button class="ds-drawer__new" @click="handleNewChat">
            <Plus class="size-4" />
            {{ $t('page.ai.chat.newChat') }}
          </button>
          <div class="ds-drawer__list">
            <div
              v-for="conv in conversations"
              :key="conv.id"
              class="ds-drawer__item"
              :class="{ active: conv.id === activeConvId }"
              @click="selectConversation(conv.id)"
            >
              <template v-if="renaming === conv.id">
                <Input
                  v-model:value="renameTitle"
                  size="small"
                  @blur="commitRename(conv.id)"
                  @press-enter="commitRename(conv.id)"
                />
              </template>
              <template v-else>
                <span class="ds-drawer__item-title">{{ conv.title }}</span>
                <span class="ds-drawer__item-actions">
                  <Button
                    size="small"
                    type="text"
                    :title="$t('page.ai.chat.renameConv')"
                    @click.stop="startRename(conv)"
                  >
                    <svg
                      class="size-3.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"
                      />
                    </svg>
                  </Button>
                  <Popconfirm
                    :title="$t('page.ai.chat.confirmDelete')"
                    @click.stop
                    @confirm="handleDeleteConv(conv.id)"
                  >
                    <Button size="small" danger type="text">
                      <svg
                        class="size-3.5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                        />
                      </svg>
                    </Button>
                  </Popconfirm>
                </span>
              </template>
            </div>
          </div>
        </aside>
      </div>
    </Transition>

    <!-- ===== 主内容 ===== -->
    <main class="ds-chat__main">
      <!-- 欢迎页 -->
      <div v-if="messages.length === 0" class="ds-chat__welcome">
        <h1 class="ds-chat__welcome-title">
          {{ $t('page.ai.chat.welcomeTitle') }}
        </h1>
        <p class="ds-chat__welcome-desc">
          {{ $t('page.ai.chat.emptyHint') }}
        </p>
      </div>

      <!-- 消息流 -->
      <div v-else ref="msgListRef" class="ds-chat__messages">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="ds-msg"
          :class="`ds-msg--${msg.role}`"
        >
          <div v-if="msg.role === 'user'" class="ds-msg__user">
            <div class="ds-msg__user-bubble">
              <span class="ds-msg__plain">{{ msg.content }}</span>
            </div>
          </div>
          <div v-else class="ds-msg__ai">
            <!-- eslint-disable vue/no-v-html -->
            <div
              v-if="msg.content"
              class="ds-msg__markdown"
              v-html="renderMd(msg.content)"
              @click="handleMarkdownClick"
            ></div>
            <!-- eslint-enable vue/no-v-html -->
            <span v-else class="ds-msg__thinking">{{
              $t('page.ai.chat.thinking')
            }}</span>
            <div
              v-if="!isStreaming || msg.id !== 'streaming'"
              class="ds-msg__actions"
            >
              <button
                class="ds-msg__action"
                :title="$t('page.ai.chat.copy')"
                @click="copyMessage(msg.content)"
              >
                <Copy class="size-4" />
              </button>
              <button
                class="ds-msg__action"
                :class="{ active: liked[msg.id] === 'up' }"
                :title="$t('page.ai.chat.thumbUp')"
                @click="toggleLike(msg.id, 'up')"
              >
                <svg
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M7 10v12" />
                  <path
                    d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
                  />
                </svg>
              </button>
              <button
                class="ds-msg__action"
                :class="{ active: liked[msg.id] === 'down' }"
                :title="$t('page.ai.chat.thumbDown')"
                @click="toggleLike(msg.id, 'down')"
              >
                <svg
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M17 14V2" />
                  <path
                    d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
                  />
                </svg>
              </button>
              <button
                class="ds-msg__action"
                :title="$t('page.ai.chat.regenerate')"
                @click="regenerate"
              >
                <RotateCw class="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 输入区 ===== -->
      <div class="ds-chat__input-area">
        <div class="ds-chat__input-box">
          <Input.TextArea
            v-model:value="inputText"
            :auto-size="{ maxRows: 10, minRows: 1 }"
            :disabled="isStreaming"
            :placeholder="$t('page.ai.chat.placeholder')"
            class="ds-chat__textarea"
            @keydown="handleKeydown"
          />
          <div class="ds-chat__input-tools">
            <Select
              v-if="knowledgeBases.length > 0"
              v-model:value="knowledgeBaseId"
              :placeholder="$t('page.ai.chat.attachKb')"
              class="ds-chat__kb-select"
              size="small"
              allow-clear
            >
              <Select.Option
                v-for="kb in knowledgeBases"
                :key="kb.id"
                :value="kb.id"
              >
                {{ kb.name }}
              </Select.Option>
            </Select>
            <div class="ds-chat__input-tools-right">
              <button
                v-if="!isStreaming"
                class="ds-chat__send"
                :disabled="!inputText.trim()"
                @click="handleSendWithStream"
              >
                <svg
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </button>
              <button
                v-else
                class="ds-chat__send ds-chat__send--stop"
                @click="handleStop"
              >
                <Square class="size-4" />
              </button>
            </div>
          </div>
        </div>
        <p class="ds-chat__input-tip">
          {{ $t('page.ai.chat.enterTip') }}
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.ds-chat {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: hsl(var(--background));
}

/* ===== 顶栏 ===== */
.ds-chat__topbar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 52px;
  border-bottom: 1px solid hsl(var(--border));
}

.ds-chat__topbar-inner {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
  max-width: 780px;
  padding: 0 16px;
}

.ds-chat__menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition: background 0.15s;
}

.ds-chat__menu-btn:hover {
  background: hsl(var(--muted));
}

.ds-chat__brand {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.2px;
}

.ds-chat__title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

/* ===== 会话抽屉 ===== */
.ds-drawer__mask {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: hsl(var(--foreground) / 30%);
}

.ds-drawer__panel {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 21;
  display: flex;
  flex-direction: column;
  width: 280px;
  background: hsl(var(--background));
  border-right: 1px solid hsl(var(--border));
  box-shadow: 4px 0 24px hsl(var(--foreground) / 10%);
}

.ds-drawer__header {
  display: flex;
  gap: 12px;
  align-items: center;
  height: 52px;
  padding: 0 12px 0 16px;
}

.ds-drawer__new {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  padding: 9px;
  margin: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: transparent;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition: background 0.15s;
}

.ds-drawer__new:hover {
  background: hsl(var(--muted));
}

.ds-drawer__list {
  flex: 1;
  padding: 4px 8px 16px;
  overflow-y: auto;
}

.ds-drawer__item {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 8px 10px;
  margin-bottom: 2px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}

.ds-drawer__item:hover {
  background: hsl(var(--muted));
}

.ds-drawer__item.active {
  background: hsl(var(--muted) / 70%);
}

.ds-drawer__item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  white-space: nowrap;
}

.ds-drawer__item-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
}

.ds-drawer__item:hover .ds-drawer__item-actions {
  opacity: 1;
}

/* 抽屉动画 */
.ds-drawer-enter-active,
.ds-drawer-leave-active {
  transition: opacity 0.2s;
}

.ds-drawer-enter-active .ds-drawer__panel,
.ds-drawer-leave-active .ds-drawer__panel {
  transition: transform 0.2s;
}

.ds-drawer-enter-from,
.ds-drawer-leave-to {
  opacity: 0;
}

.ds-drawer-enter-from .ds-drawer__panel,
.ds-drawer-leave-to .ds-drawer__panel {
  transform: translateX(-100%);
}

/* ===== 主内容 ===== */
.ds-chat__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

/* 欢迎页 */
.ds-chat__welcome {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}

.ds-chat__welcome-title {
  margin: 0;
  font-size: 30px;
  font-weight: 600;
  color: hsl(var(--foreground));
  letter-spacing: -0.5px;
}

.ds-chat__welcome-desc {
  margin: 0;
  font-size: 14px;
  color: hsl(var(--muted-foreground));
}

/* 消息流 */
.ds-chat__messages {
  flex: 1;
  width: 100%;
  max-width: 780px;
  padding: 24px 16px;
  margin: 0 auto;
  overflow-y: auto;
}

.ds-msg {
  display: flex;
  flex-direction: column;
  margin-bottom: 28px;
}

.ds-msg--user {
  align-items: flex-end;
}

.ds-msg--ai {
  align-items: flex-start;
}

.ds-msg__user-bubble {
  max-width: 72%;
  padding: 10px 14px;
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
  border-radius: 10px;
  border-bottom-right-radius: 3px;
}

.ds-msg__plain {
  font-size: 15px;
  line-height: 1.7;
  word-break: break-word;
  white-space: pre-wrap;
}

.ds-msg__ai {
  width: 100%;
}

.ds-msg__markdown {
  font-size: 15px;
  line-height: 1.75;
  color: hsl(var(--foreground));
  word-break: break-word;
}

.ds-msg__thinking {
  color: hsl(var(--muted-foreground));
  animation: ds-blink 1s infinite;
}

@keyframes ds-blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

/* 消息操作 */
.ds-msg__actions {
  display: flex;
  gap: 2px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.ds-msg:hover .ds-msg__actions {
  opacity: 1;
}

.ds-msg__action {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 5px;
  transition:
    background 0.15s,
    color 0.15s;
}

.ds-msg__action:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
}

.ds-msg__action.active {
  color: hsl(var(--primary));
}

/* ===== 输入区 ===== */
.ds-chat__input-area {
  padding: 8px 16px 20px;
}

.ds-chat__input-box {
  width: min(46vw, 780px);
  min-width: 420px;
  padding: 14px 14px 10px 18px;
  margin: 0 auto;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  box-shadow: 0 2px 12px hsl(var(--foreground) / 6%);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.ds-chat__input-box:focus-within {
  border-color: hsl(var(--primary) / 60%);
  box-shadow: 0 4px 20px hsl(var(--primary) / 14%);
}

.ds-chat__textarea {
  min-height: 52px;
  font-size: 15px;
  resize: none;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.ds-chat__input-tools {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 6px;
}

.ds-chat__kb-select {
  width: 200px;
  margin-right: auto;
}

.ds-chat__input-tools-right {
  display: flex;
  gap: 8px;
}

.ds-chat__send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  background: hsl(var(--primary));
  border: none;
  border-radius: 50%;
  transition: opacity 0.15s;
}

.ds-chat__send:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.ds-chat__send--stop {
  background: hsl(var(--destructive, 0 72% 51%));
}

.ds-chat__input-tip {
  max-width: 780px;
  margin: 8px auto 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

/* ===== Markdown ===== */
.ds-msg__markdown :deep(p) {
  margin: 0 0 10px;

  &:last-child {
    margin-bottom: 0;
  }
}

.ds-msg__markdown :deep(h1),
.ds-msg__markdown :deep(h2),
.ds-msg__markdown :deep(h3) {
  margin: 14px 0 8px;
  font-weight: 600;
}

.ds-msg__markdown :deep(ul),
.ds-msg__markdown :deep(ol) {
  padding-left: 22px;
  margin: 8px 0;
}

.ds-msg__markdown :deep(li) {
  margin: 3px 0;
}

.ds-msg__markdown :deep(blockquote) {
  padding-left: 12px;
  margin: 10px 0;
  color: hsl(var(--muted-foreground));
  border-left: 3px solid hsl(var(--border));
}

.ds-msg__markdown :deep(.ai-code-block) {
  position: relative;
  margin: 10px 0;
  overflow-x: auto;
  background: hsl(var(--secondary));
  border-radius: 8px;
}

.ds-msg__markdown :deep(.ai-code-block code) {
  display: block;
  padding: 14px;
  font-size: 13px;
  line-height: 1.6;
}

.ds-msg__markdown :deep(.ai-copy-btn) {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 3px 8px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 5px;
  opacity: 0;
  transition: opacity 0.2s;
}

.ds-msg__markdown :deep(.ai-copy-btn svg) {
  width: 12px;
  height: 12px;
}

.ds-msg__markdown :deep(.ai-code-block:hover .ai-copy-btn) {
  opacity: 1;
}

.ds-msg__markdown :deep(code:not(.hljs)) {
  padding: 2px 5px;
  font-size: 13px;
  background: hsl(var(--secondary));
  border-radius: 3px;
}

.ds-msg__markdown :deep(table) {
  width: 100%;
  margin: 10px 0;
  font-size: 13px;
  border-collapse: collapse;
}

.ds-msg__markdown :deep(th),
.ds-msg__markdown :deep(td) {
  padding: 6px 10px;
  text-align: left;
  border: 1px solid hsl(var(--border));
}

.ds-msg__markdown :deep(th) {
  background: hsl(var(--secondary));
}
</style>
