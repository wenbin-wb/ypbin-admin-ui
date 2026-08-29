<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { message } from 'ant-design-vue';

import { $t } from '#/locales';
import { useMarkdownRenderer } from '#/views/ai/_shared/useMarkdownRenderer';

defineOptions({ name: 'ChatMessageList' });

const props = withDefaults(
  defineProps<{
    isStreaming?: boolean;
    loading?: boolean;
    messages?: AiApi.ChatMessage[];
  }>(),
  {
    isStreaming: false,
    loading: false,
    messages: () => [],
  },
);

const emit = defineEmits<{
  (e: 'regenerate'): void;
  (e: 'scroll-bottom', force?: boolean): void;
}>();

const { renderMarkdown } = useMarkdownRenderer({
  copyButton: true,
  copyLabel: $t('page.ai.chat.copy'),
});

const msgListRef = ref<HTMLElement>();

defineExpose({ msgListRef });

function isErrorText(content: string): boolean {
  return (
    content.startsWith($t('page.ai.chat.chatErrorPrefix')) ||
    content.startsWith('Request failed')
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay)
    return d.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

async function copyMessage(content: string) {
  try {
    await navigator.clipboard.writeText(content);
    message.success($t('page.ai.chat.copied'));
  } catch {
    message.warning($t('common.requestFailed'));
  }
}

function handleMarkdownClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.ai-copy-btn');
  if (!target) return;
  const code = target.nextElementSibling?.textContent ?? '';
  navigator.clipboard
    .writeText(code)
    .then(() => {
      message.success($t('page.ai.chat.copied'));
    })
    .catch((error) => {
      console.error('Failed to copy code block:', error);
      message.warning($t('common.requestFailed'));
    });
}
</script>

<template>
  <!-- ===== 消息列表 ===== -->
  <div ref="msgListRef" class="ym-ai__messages">
    <!-- 加载骨架 -->
    <div v-if="loading" class="ym-ai__msg-loading">
      <div
        v-for="i in 3"
        :key="i"
        class="ym-ai__msg-skeleton"
        :class="i % 2 === 0 ? 'user' : 'ai'"
      ></div>
    </div>

    <template v-else>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="ym-ai__msg"
        :class="`ym-ai__msg--${msg.role}`"
      >
        <!-- AI 消息 -->
        <template v-if="msg.role === 'assistant'">
          <div class="ym-ai__msg-avatar ym-ai__msg-avatar--ai">
            <IconifyIcon icon="lucide:bot" class="size-4" />
          </div>
          <div class="ym-ai__msg-body">
            <!-- eslint-disable vue/no-v-html -->
            <div
              v-if="msg.content"
              class="ym-ai__markdown"
              :class="{
                'ym-ai__markdown--error': isErrorText(msg.content),
              }"
              v-html="renderMarkdown(msg.content)"
              @click="handleMarkdownClick"
            ></div>
            <!-- eslint-enable vue/no-v-html -->
            <!-- 流式光标 -->
            <span
              v-else-if="isStreaming && msg.id === 'streaming'"
              class="ym-ai__cursor"
            ></span>
            <span v-else class="ym-ai__thinking">{{
              $t('page.ai.chat.thinking')
            }}</span>

            <!-- 消息操作（非流式时显示） -->
            <div v-if="msg.id !== 'streaming'" class="ym-ai__msg-actions">
              <button
                class="ym-ai__action"
                :title="$t('page.ai.chat.copy')"
                @click="copyMessage(msg.content)"
              >
                <svg
                  class="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                  stroke-linecap="round"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" />
                  <path
                    d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                  />
                </svg>
              </button>
              <span class="ym-ai__msg-time">{{
                formatTime(msg.createTime)
              }}</span>
            </div>
            <!-- 生成中 loading indicator -->
            <div
              v-if="isStreaming && msg.id === 'streaming' && msg.content"
              class="ym-ai__msg-actions"
            >
              <span class="ym-ai__generating">
                <span class="ym-ai__dot"></span><span class="ym-ai__dot"></span><span class="ym-ai__dot"></span>
                {{ $t('page.ai.chat.generating') }}
              </span>
            </div>
          </div>
        </template>

        <!-- 用户消息：body 在前 avatar 在后，配合 justify-content:flex-end 实现「气泡｜头像」右对齐 -->
        <template v-else-if="msg.role === 'user'">
          <div class="ym-ai__msg-body ym-ai__msg-body--user">
            <div class="ym-ai__user-bubble">{{ msg.content }}</div>
            <div class="ym-ai__msg-actions ym-ai__msg-actions--user">
              <button
                class="ym-ai__action"
                :title="$t('page.ai.chat.copy')"
                @click="copyMessage(msg.content)"
              >
                <svg
                  class="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                  stroke-linecap="round"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" />
                  <path
                    d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                  />
                </svg>
              </button>
              <span class="ym-ai__msg-time">{{
                formatTime(msg.createTime)
              }}</span>
            </div>
          </div>
          <div class="ym-ai__msg-avatar ym-ai__msg-avatar--user">
            {{ $t('page.ai.chat.msgUser') }}
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ================================================================
   消息列表
================================================================ */
.ym-ai__messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  padding: 16px 20px;
  overflow-y: auto;
  scrollbar-width: none;
}

.ym-ai__messages::-webkit-scrollbar {
  display: none;
}

/* 骨架 */
.ym-ai__msg-loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ym-ai__msg-skeleton {
  height: 52px;
  background: hsl(var(--muted));
  border-radius: 12px;
  animation: ym-shimmer 1.4s ease infinite;
}

.ym-ai__msg-skeleton.ai {
  align-self: flex-start;
  width: 70%;
}

.ym-ai__msg-skeleton.user {
  align-self: flex-end;
  width: 55%;
}

@keyframes ym-shimmer {
  0%,
  100% {
    opacity: 0.4;
  }

  50% {
    opacity: 0.8;
  }
}

/* 消息行 */
.ym-ai__msg {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  max-width: 100%;
}

.ym-ai__msg--user {
  justify-content: flex-end;
}

/* 头像 */
.ym-ai__msg-avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-top: 2px;
  font-size: 13px;
  font-weight: 700;
  user-select: none;
  border-radius: 50%;
}

.ym-ai__msg-avatar--ai {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 15%);
}

.ym-ai__msg-avatar--user {
  font-size: 12px;
  color: hsl(var(--secondary-foreground));
  background: hsl(var(--secondary));
}

/* 消息体 */
.ym-ai__msg-body {
  min-width: 0;
  max-width: min(680px, calc(100% - 42px));
}

.ym-ai__msg--assistant .ym-ai__msg-body {
  flex: 1;
}

.ym-ai__msg-body--user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

/* 用户气泡 */
.ym-ai__user-bubble {
  max-width: 100%;
  padding: 9px 14px;
  font-size: 14px;
  line-height: 1.6;
  color: hsl(var(--primary-foreground));
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: hsl(var(--primary));
  border-radius: 18px 18px 4px;
}

/* AI Markdown */
.ym-ai__markdown {
  font-size: 14px;
  line-height: 1.75;
  color: hsl(var(--foreground));
  overflow-wrap: anywhere;
}

.ym-ai__markdown--error {
  color: hsl(var(--destructive));
}

/* 消息操作栏 */
.ym-ai__msg-actions {
  display: flex;
  gap: 2px;
  align-items: center;
  margin-top: 6px;
  opacity: 0;
  transition: opacity 0.15s;
}

.ym-ai__msg--assistant:hover .ym-ai__msg-actions,
.ym-ai__msg--user:hover .ym-ai__msg-actions {
  opacity: 1;
}

.ym-ai__msg-actions--user {
  justify-content: flex-end;
}

.ym-ai__action {
  display: flex;
  align-items: center;
  padding: 4px 5px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 5px;
  transition:
    background 0.12s,
    color 0.12s;
}

.ym-ai__action:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
}

.ym-ai__msg-time {
  padding: 0 4px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  user-select: none;
}

/* 思考中 + 流式光标 */
.ym-ai__thinking {
  font-size: 13px;
  font-style: italic;
  color: hsl(var(--muted-foreground));
}

.ym-ai__cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  vertical-align: text-bottom;
  background: hsl(var(--primary));
  border-radius: 1px;
  animation: ym-blink 0.9s steps(2) infinite;
}

@keyframes ym-blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}

/* 生成中指示器 */
.ym-ai__generating {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ym-ai__dot {
  display: inline-block;
  width: 4px;
  height: 4px;
  background: hsl(var(--muted-foreground));
  border-radius: 50%;
  animation: ym-bounce 1.2s ease infinite;
}

.ym-ai__dot:nth-child(2) {
  animation-delay: 0.2s;
}

.ym-ai__dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes ym-bounce {
  0%,
  80%,
  100% {
    opacity: 0.4;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-4px);
  }
}
</style>

<style>
/* 代码块全局样式（配合 useMarkdownRenderer 的 copyButton 渲染） */
.ym-ai__markdown .ai-code-block {
  position: relative;
  margin: 12px 0;
  overflow: hidden;
  background: hsl(var(--muted) / 60%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.ym-ai__markdown .ai-code-block::before {
  position: absolute;
  top: 0;
  left: 0;
  padding: 2px 10px;
  font-size: 10px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  content: attr(data-lang);
  background: hsl(var(--muted));
  border-right: 1px solid hsl(var(--border));
  border-bottom: 1px solid hsl(var(--border));
  border-bottom-right-radius: 6px;
}

.ym-ai__markdown .ai-code-block code {
  display: block;
  padding: 28px 14px 12px;
  overflow-x: auto;
  font-family: 'Fira Code', 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12.5px;
  line-height: 1.65;
  scrollbar-width: none;
}

.ym-ai__markdown .ai-code-block code::-webkit-scrollbar {
  display: none;
}

.ym-ai__markdown .ai-copy-btn {
  position: absolute;
  top: 4px;
  right: 8px;
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 4px;
  opacity: 0;
  transition:
    opacity 0.15s,
    background 0.12s;
}

.ym-ai__markdown .ai-code-block:hover .ai-copy-btn {
  opacity: 1;
}

.ym-ai__markdown .ai-copy-btn:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
}

.ym-ai__markdown .ai-copy-btn svg {
  width: 12px;
  height: 12px;
}

/* Markdown 正文排版 */
.ym-ai__markdown p {
  margin: 0.5em 0;
}

.ym-ai__markdown p:first-child {
  margin-top: 0;
}

.ym-ai__markdown p:last-child {
  margin-bottom: 0;
}

.ym-ai__markdown h1,
.ym-ai__markdown h2,
.ym-ai__markdown h3 {
  margin: 1em 0 0.4em;
  font-weight: 700;
  line-height: 1.4;
}

.ym-ai__markdown h1 {
  font-size: 1.3em;
}

.ym-ai__markdown h2 {
  font-size: 1.15em;
}

.ym-ai__markdown h3 {
  font-size: 1em;
}

.ym-ai__markdown ul,
.ym-ai__markdown ol {
  padding-left: 1.4em;
  margin: 0.5em 0;
}

.ym-ai__markdown li {
  margin: 0.2em 0;
}

.ym-ai__markdown blockquote {
  padding: 4px 12px;
  margin: 0.75em 0;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 30%);
  border-left: 3px solid hsl(var(--primary) / 40%);
  border-radius: 0 6px 6px 0;
}

.ym-ai__markdown code:not(.hljs) {
  padding: 0.1em 0.35em;
  font-family: 'Fira Code', ui-monospace, monospace;
  font-size: 0.85em;
  background: hsl(var(--muted));
  border-radius: 4px;
}

.ym-ai__markdown table {
  width: 100%;
  margin: 0.75em 0;
  font-size: 13px;
  border-collapse: collapse;
}

.ym-ai__markdown th,
.ym-ai__markdown td {
  padding: 6px 10px;
  border: 1px solid hsl(var(--border));
}

.ym-ai__markdown th {
  font-weight: 600;
  background: hsl(var(--muted));
}

.ym-ai__markdown tr:hover td {
  background: hsl(var(--muted) / 30%);
}

.ym-ai__markdown a {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.ym-ai__markdown hr {
  margin: 1em 0;
  border: none;
  border-top: 1px solid hsl(var(--border));
}
</style>
