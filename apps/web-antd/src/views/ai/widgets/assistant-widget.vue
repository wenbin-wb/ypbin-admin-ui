<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';

import { Button, Input, Tooltip } from 'ant-design-vue';

import { chat, createSession, getSessionMessages } from '#/api/ai';
import { $t } from '#/locales';
import { useMarkdownRenderer } from '#/views/ai/_shared/useMarkdownRenderer';

defineOptions({ name: 'AiAssistantWidget' });

const { renderMarkdown } = useMarkdownRenderer();

const STORAGE_KEY = 'ypbin_ai_assistant_widget_pos';
const WIDGET_WIDTH = 124;
const WIDGET_HEIGHT = 38;
const PANEL_HEIGHT = 530;
const MARGIN = 16;

const open = ref(false);
const isDocked = ref(false);
const isDragging = ref(false);
const isHovering = ref(false);
const messages = ref<AiApi.ChatMessage[]>([]);
const inputText = ref('');
const isStreaming = ref(false);
const sending = ref(false);
const listRef = ref<HTMLElement>();
const sessionId = ref('');
let abortController: AbortController | null = null;

// ---------- 拖拽与贴边位置管理 ----------
interface PositionState {
  side: 'left' | 'right';
  top: number;
  docked: boolean;
}

const pos = reactive<PositionState>({
  side: 'right',
  top: window.innerHeight - 100,
  docked: false,
});

let dragStartX = 0;
let dragStartY = 0;
let initialTop = 0;
let hasMoved = false;

function loadSavedPosition() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PositionState>;
      if (parsed.side === 'left' || parsed.side === 'right') {
        pos.side = parsed.side;
      }
      if (typeof parsed.top === 'number') {
        const maxTop = window.innerHeight - WIDGET_HEIGHT - MARGIN;
        pos.top = Math.max(MARGIN + 48, Math.min(maxTop, parsed.top));
      }
      if (typeof parsed.docked === 'boolean') {
        pos.docked = parsed.docked;
        isDocked.value = parsed.docked;
      }
    } else {
      pos.top = window.innerHeight - 100;
      pos.side = 'right';
    }
  } catch {
    pos.top = window.innerHeight - 100;
    pos.side = 'right';
  }
}

function savePosition() {
  try {
    pos.docked = isDocked.value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // 忽略存储异常
  }
}

function handlePointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest('.ai-badge-dock-btn')) return;

  dragStartX = e.clientX;
  dragStartY = e.clientY;
  initialTop = pos.top;
  hasMoved = false;

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
}

function handlePointerMove(e: PointerEvent) {
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;

  if (!hasMoved && Math.hypot(dx, dy) > 4) {
    hasMoved = true;
    isDragging.value = true;
    isDocked.value = false;
  }

  if (isDragging.value) {
    const nextTop = initialTop + dy;
    const maxTop = window.innerHeight - WIDGET_HEIGHT - MARGIN;
    pos.top = Math.max(MARGIN + 48, Math.min(maxTop, nextTop));

    pos.side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
  }
}

function handlePointerUp() {
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', handlePointerUp);

  if (isDragging.value) {
    isDragging.value = false;
    savePosition();
  } else {
    toggleOpen();
  }
}

function handleWindowResize() {
  const maxTop = window.innerHeight - WIDGET_HEIGHT - MARGIN;
  if (pos.top > maxTop) {
    pos.top = Math.max(MARGIN + 48, maxTop);
  }
}

onMounted(() => {
  loadSavedPosition();
  window.addEventListener('resize', handleWindowResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize);
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
});

// ---------- 贴边收起与展开 ----------
function toggleDock(e?: Event) {
  if (e) {
    e.stopPropagation();
  }
  isDocked.value = !isDocked.value;
  if (isDocked.value) {
    open.value = false;
  }
  savePosition();
}

function handleTabClick() {
  isDocked.value = false;
  open.value = true;
  savePosition();
  void ensureSession();
  void scrollToBottom();
}

// ---------- 对话面板定位与交互 ----------
const widgetStyle = computed(() => {
  const top = `${pos.top}px`;
  if (pos.side === 'left') {
    return { left: `${MARGIN}px`, top };
  }
  return { right: `${MARGIN}px`, top };
});

const tabStyle = computed(() => {
  const top = `${pos.top}px`;
  if (pos.side === 'left') {
    return { left: '0px', top };
  }
  return { right: '0px', top };
});

const panelStyle = computed(() => {
  let top = pos.top + WIDGET_HEIGHT - PANEL_HEIGHT;
  if (top < MARGIN + 48) {
    top = MARGIN + 48;
  }
  if (top + PANEL_HEIGHT > window.innerHeight - MARGIN) {
    top = window.innerHeight - PANEL_HEIGHT - MARGIN;
  }

  if (pos.side === 'left') {
    return {
      left: `${MARGIN + WIDGET_WIDTH + 10}px`,
      top: `${top}px`,
    };
  }
  return {
    right: `${MARGIN + WIDGET_WIDTH + 10}px`,
    top: `${top}px`,
  };
});

async function scrollToBottom() {
  await nextTick();
  if (listRef.value) {
    listRef.value.scrollTop = listRef.value.scrollHeight;
  }
}

async function toggleOpen() {
  open.value = !open.value;
  if (open.value) {
    isDocked.value = false;
    await ensureSession();
    await scrollToBottom();
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
        assistantMsg.content = error.message || $t('page.ai.chat.requestError');
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
</script>

<template>
  <!-- 模式 A：贴边半隐窄拉手 (isDocked 且面板未打开时显示，不遮挡任何内容) -->
  <div
    v-if="isDocked && !open"
    class="ai-edge-tab"
    :class="`ai-edge-tab--${pos.side}`"
    :style="tabStyle"
    :title="$t('page.ai.widget.badge')"
    @click="handleTabClick"
  >
    <div class="ai-edge-tab__inner">
      <svg
        class="ai-edge-tab__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M12 2l2.4 5.2L20 9.6l-4 4.2.9 5.8-4.9-2.6-4.9 2.6.9-5.8-4-4.2 5.6-2.4L12 2z"
        />
      </svg>
      <span class="ai-edge-tab__pulse"></span>
    </div>
  </div>

  <!-- 模式 B：悬浮胶囊徽标 (正常展示状态) -->
  <div
    v-else
    class="ai-widget-badge"
    :class="[
      `ai-widget-badge--${pos.side}`,
      {
        'ai-widget-badge--open': open,
        'ai-widget-badge--dragging': isDragging,
      },
    ]"
    :style="widgetStyle"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
    @pointerdown="handlePointerDown"
  >
    <!-- 拖拽握把点阵 -->
    <div class="ai-widget-badge__grip" :title="$t('page.ai.widget.dragTip')">
      <span class="ai-widget-badge__dot"></span>
      <span class="ai-widget-badge__dot"></span>
      <span class="ai-widget-badge__dot"></span>
      <span class="ai-widget-badge__dot"></span>
      <span class="ai-widget-badge__dot"></span>
      <span class="ai-widget-badge__dot"></span>
    </div>

    <!-- AI 晶体图标 + 状态微灯 -->
    <div class="ai-widget-badge__icon-wrap">
      <svg
        class="ai-widget-badge__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M12 2l2.4 5.2L20 9.6l-4 4.2.9 5.8-4.9-2.6-4.9 2.6.9-5.8-4-4.2 5.6-2.4L12 2z"
        />
        <path
          d="M19 2l.8 1.8L22 4.6l-1.6 1.7.4 2.3-2-.9-2 .9.4-2.3-1.6-1.7 2.2-.8L19 2z"
        />
      </svg>
      <span class="ai-widget-badge__pulse"></span>
    </div>

    <!-- 标签文字 -->
    <span class="ai-widget-badge__text">{{ $t('page.ai.widget.badge') }}</span>

    <!-- 快捷贴边收起按钮 -->
    <button
      type="button"
      class="ai-badge-dock-btn"
      :title="$t('page.ai.widget.dock')"
      @click.stop="toggleDock"
    >
      <svg
        class="size-3 text-muted-foreground hover:text-foreground"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path v-if="pos.side === 'right'" d="M9 18l6-6-6-6" />
        <path v-else d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  </div>

  <!-- 对话面板 -->
  <Teleport to="body">
    <Transition name="ai-panel-pop">
      <div v-if="open" class="ai-widget-panel" :style="panelStyle">
        <!-- 头部栏 -->
        <div class="ai-widget-panel__header">
          <div class="ai-widget-panel__title-group">
            <div class="ai-widget-panel__icon-box">
              <svg
                class="size-4 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M12 2l2.4 5.2L20 9.6l-4 4.2.9 5.8-4.9-2.6-4.9 2.6.9-5.8-4-4.2 5.6-2.4L12 2z"
                />
              </svg>
            </div>
            <div class="flex flex-col">
              <span class="ai-widget-panel__title">{{
                $t('page.ai.widget.title')
              }}</span>
              <span class="ai-widget-panel__status">
                <span class="ai-widget-panel__status-dot"></span>
                {{ $t('page.ai.widget.statusOnline') }}
              </span>
            </div>
          </div>

          <!-- 工具按钮组 -->
          <div class="ai-widget-panel__tools">
            <Tooltip :title="$t('page.ai.widget.newChat')">
              <Button
                size="small"
                type="text"
                class="ai-tool-btn"
                @click="handleNewChat"
              >
                <svg
                  class="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </Button>
            </Tooltip>
            <Tooltip :title="$t('page.ai.widget.dock')">
              <Button
                size="small"
                type="text"
                class="ai-tool-btn"
                @click="toggleDock"
              >
                <svg
                  class="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M5 12h14" />
                </svg>
              </Button>
            </Tooltip>
            <Button
              size="small"
              type="text"
              class="ai-tool-btn"
              @click="open = false"
            >
              <svg
                class="size-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
                stroke-linecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>

        <!-- 消息内容区 -->
        <div ref="listRef" class="ai-widget-panel__list">
          <!-- 空状态欢迎区 -->
          <div v-if="messages.length === 0" class="ai-widget-panel__empty">
            <div class="ai-widget-panel__welcome-icon">
              <svg
                class="size-8 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M12 2l2.4 5.2L20 9.6l-4 4.2.9 5.8-4.9-2.6-4.9 2.6.9-5.8-4-4.2 5.6-2.4L12 2z"
                />
              </svg>
            </div>
            <h4 class="ai-widget-panel__welcome-title">
              {{ $t('page.ai.widget.title') }}
            </h4>
            <p class="ai-widget-panel__welcome-desc">
              {{ $t('page.ai.widget.hint') }}
            </p>

            <!-- 快捷推荐问题 -->
            <div class="ai-widget-panel__prompts">
              <span class="ai-widget-panel__prompts-label">{{
                $t('page.ai.widget.quickTitle')
              }}</span>
              <button
                v-for="(prompt, index) in quickPrompts"
                :key="index"
                class="ai-widget-panel__prompt-chip"
                @click="handleSend(prompt)"
              >
                <span>{{ prompt }}</span>
                <svg
                  class="size-3 opacity-60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 消息列表 -->
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="ai-msg"
            :class="`ai-msg--${msg.role}`"
          >
            <template v-if="msg.role === 'user'">
              <div class="ai-msg__bubble ai-msg__bubble--user">
                {{ msg.content }}
              </div>
            </template>
            <template v-else>
              <!-- eslint-disable vue/no-v-html -->
              <div
                v-if="msg.content"
                class="ai-msg__markdown"
                v-html="renderMarkdown(msg.content)"
              ></div>
              <!-- eslint-enable vue/no-v-html -->
              <div v-else class="ai-msg__thinking-box">
                <span class="ai-msg__thinking-dot"></span>
                <span class="ai-msg__thinking-dot"></span>
                <span class="ai-msg__thinking-dot"></span>
                <span class="text-xs text-muted-foreground">{{
                  $t('page.ai.chat.thinking')
                }}</span>
              </div>
            </template>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="ai-widget-panel__input-area">
          <Input.TextArea
            v-model:value="inputText"
            :auto-size="{ maxRows: 4, minRows: 1 }"
            :disabled="isStreaming"
            :placeholder="$t('page.ai.widget.placeholder')"
            class="ai-widget-panel__textarea"
            @keydown="handleKeydown"
          />
          <div class="ai-widget-panel__actions">
            <Button
              v-if="!isStreaming"
              :disabled="!inputText.trim()"
              shape="circle"
              size="small"
              type="primary"
              class="ai-send-btn"
              @click="handleSend()"
            >
              <svg
                class="size-3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </Button>
            <Button
              v-else
              danger
              shape="circle"
              size="small"
              class="ai-send-btn"
              @click="handleStop"
            >
              <svg class="size-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect height="10" width="10" x="7" y="7" rx="1" />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ---------- 模式 A：贴边半隐窄拉手 (Edge Tab) ---------- */
.ai-edge-tab {
  position: fixed;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 48px;
  cursor: pointer;
  user-select: none;
  background: hsl(var(--primary) / 18%);
  border: 1px solid hsl(var(--primary) / 30%);
  opacity: 0.55;
  backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.ai-edge-tab:hover {
  width: 28px;
  background: hsl(var(--primary) / 25%);
  border-color: hsl(var(--primary) / 50%);
  box-shadow: 0 4px 16px -2px hsl(var(--primary) / 35%);
  opacity: 1;
}

.ai-edge-tab--right {
  right: 0;
  border-right: none;
  border-radius: 8px 0 0 8px;
}

.ai-edge-tab--left {
  left: 0;
  border-left: none;
  border-radius: 0 8px 8px 0;
}

.ai-edge-tab__inner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--primary));
}

.ai-edge-tab__icon {
  width: 12px;
  height: 12px;
  transition: transform 0.2s;
}

.ai-edge-tab:hover .ai-edge-tab__icon {
  transform: scale(1.15);
}

.ai-edge-tab__pulse {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 4px;
  height: 4px;
  background: #10b981;
  border-radius: 50%;
}

/* ---------- 模式 B：悬浮胶囊徽标 (Widget Badge) ---------- */
.ai-widget-badge {
  position: fixed;
  z-index: 3000;
  display: flex;
  gap: 6px;
  align-items: center;
  height: 38px;
  padding: 0 8px;
  cursor: pointer;
  user-select: none;
  background: hsl(var(--card) / 90%);
  border: 1px solid hsl(var(--border) / 85%);
  border-radius: 9999px;
  box-shadow:
    0 6px 20px -3px rgb(0 0 0 / 12%),
    0 0 0 1px hsl(var(--primary) / 12%);
  backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.ai-widget-badge:hover {
  border-color: hsl(var(--primary) / 45%);
  box-shadow:
    0 10px 24px -4px rgb(0 0 0 / 16%),
    0 0 0 2px hsl(var(--primary) / 25%);
  transform: translateY(-2px);
}

.ai-widget-badge--open {
  border-color: hsl(var(--primary));
  box-shadow:
    0 0 0 2px hsl(var(--primary) / 30%),
    0 8px 20px -3px rgb(0 0 0 / 18%);
}

.ai-widget-badge--dragging {
  cursor: grabbing !important;
  opacity: 0.92;
  transform: scale(1.04);
  transition: none !important;
}

/* 拖拽握把点阵 */
.ai-widget-badge__grip {
  display: grid;
  grid-template-columns: repeat(2, 3px);
  gap: 2px;
  padding: 0 2px;
  cursor: grab;
  opacity: 0.35;
  transition: opacity 0.2s;
}

.ai-widget-badge:hover .ai-widget-badge__grip {
  opacity: 0.75;
}

.ai-widget-badge__dot {
  width: 2.5px;
  height: 2.5px;
  background: hsl(var(--foreground));
  border-radius: 50%;
}

/* 晶体图标与呼吸灯 */
.ai-widget-badge__icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
  border-radius: 7px;
}

.ai-widget-badge__icon {
  width: 14px;
  height: 14px;
}

.ai-widget-badge__pulse {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 5px;
  height: 5px;
  background: #10b981;
  border: 1.5px solid hsl(var(--card));
  border-radius: 50%;
}

.ai-widget-badge__text {
  font-size: 12.5px;
  font-weight: 600;
  color: hsl(var(--foreground));
  letter-spacing: 0.2px;
}

/* 胶囊内一键贴边收起按钮 */
.ai-badge-dock-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: 2px;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 50%;
  opacity: 0.6;
  transition: all 0.15s ease;
}

.ai-badge-dock-btn:hover {
  background: hsl(var(--muted));
  opacity: 1;
}

/* ---------- 浮动对话面板 (Panel) ---------- */
.ai-widget-panel {
  position: fixed;
  z-index: 3001;
  display: flex;
  flex-direction: column;
  width: 380px;
  height: 530px;
  overflow: hidden;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  box-shadow:
    0 20px 48px -8px rgb(0 0 0 / 22%),
    0 0 0 1px hsl(var(--border) / 50%);
}

.ai-widget-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  padding: 0 12px 0 16px;
  background: hsl(var(--muted) / 25%);
  border-bottom: 1px solid hsl(var(--border));
}

.ai-widget-panel__title-group {
  display: flex;
  gap: 10px;
  align-items: center;
}

.ai-widget-panel__icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: hsl(var(--primary) / 12%);
  border-radius: 8px;
}

.ai-widget-panel__title {
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.2;
  color: hsl(var(--foreground));
}

.ai-widget-panel__status {
  display: flex;
  gap: 5px;
  align-items: center;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ai-widget-panel__status-dot {
  width: 5px;
  height: 5px;
  background: #10b981;
  border-radius: 50%;
}

.ai-widget-panel__tools {
  display: flex;
  gap: 4px;
  align-items: center;
}

.ai-tool-btn {
  color: hsl(var(--muted-foreground)) !important;
  border-radius: 6px !important;
}

.ai-tool-btn:hover {
  color: hsl(var(--foreground)) !important;
  background: hsl(var(--muted)) !important;
}

/* 消息列表区 */
.ai-widget-panel__list {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.ai-widget-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 8px;
  text-align: center;
}

.ai-widget-panel__welcome-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  margin-bottom: 12px;
  background: hsl(var(--primary) / 10%);
  border-radius: 14px;
}

.ai-widget-panel__welcome-title {
  margin-bottom: 6px;
  font-size: 15px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.ai-widget-panel__welcome-desc {
  max-width: 260px;
  margin-bottom: 20px;
  font-size: 12.5px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.ai-widget-panel__prompts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.ai-widget-panel__prompts-label {
  font-size: 11.5px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  text-align: left;
}

.ai-widget-panel__prompt-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  font-size: 12.5px;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background: hsl(var(--muted) / 40%);
  border: 1px solid hsl(var(--border) / 60%);
  border-radius: 8px;
  transition: all 0.15s ease;
}

.ai-widget-panel__prompt-chip:hover {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 30%);
  transform: translateX(2px);
}

/* 消息气泡 */
.ai-msg {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 13px;
  line-height: 1.6;
}

.ai-msg--user {
  justify-content: flex-end;
}

.ai-msg__bubble--user {
  max-width: 84%;
  padding: 8px 12px;
  color: hsl(var(--primary-foreground));
  overflow-wrap: break-word;
  white-space: pre-wrap;
  background: hsl(var(--primary));
  border-radius: 12px;
  border-bottom-right-radius: 3px;
  box-shadow: 0 2px 8px -2px hsl(var(--primary) / 30%);
}

.ai-msg__markdown {
  max-width: 88%;
  padding: 10px 12px;
  overflow-wrap: break-word;
  background: hsl(var(--muted) / 45%);
  border: 1px solid hsl(var(--border) / 50%);
  border-radius: 12px;
  border-bottom-left-radius: 3px;
}

.ai-msg__markdown :deep(.hljs-pre) {
  padding: 10px;
  margin: 8px 0;
  overflow-x: auto;
  font-size: 12px;
  background: hsl(var(--secondary));
  border-radius: 8px;
}

.ai-msg__thinking-box {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 8px 12px;
  background: hsl(var(--muted) / 40%);
  border-radius: 10px;
}

.ai-msg__thinking-dot {
  width: 5px;
  height: 5px;
  background: hsl(var(--primary));
  border-radius: 50%;
  animation: ai-dot-bounce 1.4s infinite ease-in-out both;
}

.ai-msg__thinking-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.ai-msg__thinking-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes ai-dot-bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }

  40% {
    transform: scale(1);
  }
}

/* 输入区域 */
.ai-widget-panel__input-area {
  padding: 10px 12px;
  background: hsl(var(--background));
  border-top: 1px solid hsl(var(--border));
}

.ai-widget-panel__textarea {
  resize: none;
  background: hsl(var(--muted) / 35%) !important;
  border: 1px solid hsl(var(--border) / 60%) !important;
  border-radius: 10px !important;
  box-shadow: none !important;
}

.ai-widget-panel__textarea:focus {
  border-color: hsl(var(--primary) / 50%) !important;
}

.ai-widget-panel__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.ai-send-btn {
  box-shadow: 0 2px 6px -1px hsl(var(--primary) / 30%);
}

/* 动效 */
.ai-panel-pop-enter-active,
.ai-panel-pop-leave-active {
  transition:
    opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.ai-panel-pop-enter-from,
.ai-panel-pop-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}
</style>
