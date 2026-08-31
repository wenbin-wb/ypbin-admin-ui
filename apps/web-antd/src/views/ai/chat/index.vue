<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon, RotateCw } from '@vben/icons';

import { Button, Tooltip } from 'ant-design-vue';

import { chat, createSession } from '#/api/ai';
import { $t } from '#/locales';
import { roleBadge } from '#/views/ai/_shared/role-badge';

import InputBar from './components/InputBar.vue';
import MessageList from './components/MessageList.vue';
import RolePicker from './components/RolePicker.vue';
import SessionSidebar from './components/SessionSidebar.vue';
import { useChatResources } from './use-chat-resources';
import { useChatSessions } from './use-chat-sessions';

import '#/views/ai/_shared/role-badge.css';

defineOptions({ name: 'AiChat' });

// ===== 消息与发送（页面核心编排） =====
const sidebarOpen = ref(true);
const messages = ref<AiApi.ChatMessage[]>([]);
const inputText = ref('');
const isStreaming = ref(false);
let abortController: AbortController | null = null;
const msgListRef = ref<InstanceType<typeof MessageList>>();
const welcomeRef = ref<HTMLElement>();

async function scrollToBottom(force = false) {
  await nextTick();
  const el = msgListRef.value?.msgListRef ?? welcomeRef.value;
  if (!el) return;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  if (force || nearBottom) el.scrollTop = el.scrollHeight;
}

// ===== 会话域（列表/选中/删除/置顶/重命名） =====
const {
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
} = useChatSessions({ isStreaming, messages, scrollToBottom });

// ===== 资源域（角色/模型/知识库） =====
const {
  activeKbId,
  activeModelId,
  activeRole,
  featuredRoles,
  knowledgeBases,
  loadKnowledgeBases,
  loadModels,
  loadRoles,
  models,
  roleCategory,
  roleDrawerOpen,
  roleSearch,
  roles,
  selectRole,
  toggleFavorite,
} = useChatResources({ activeModelId: ref('') });

function createNewSession(roleId?: string) {
  if (roleId) {
    activeRole.value = roles.value.find((r) => r.id === roleId) ?? null;
  }
  resetToNewSession();
  roleDrawerOpen.value = false;
  inputText.value = '';
}

function handleNewChatWithRole(roleId: string) {
  roleDrawerOpen.value = false;
  createNewSession(roleId);
}

// ===== 发送 =====
async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value) return;

  let sessionId = activeSessionId.value;
  if (!sessionId) {
    try {
      sessionId = await createSession({
        roleId: activeRole.value?.id || undefined,
        modelId: activeModelId.value || undefined,
      });
      await loadSessions();
      activeSessionId.value = sessionId;
    } catch (error) {
      console.error('Failed to create session:', error);
      return;
    }
  }

  messages.value.push({
    content: text,
    createTime: new Date().toISOString(),
    id: `u-${Date.now()}`,
    role: 'user',
  });

  const assistantMsg = reactive<AiApi.ChatMessage>({
    content: '',
    createTime: new Date().toISOString(),
    id: 'streaming',
    role: 'assistant',
  });
  messages.value.push(assistantMsg);
  isStreaming.value = true;
  inputText.value = '';
  await scrollToBottom(true);

  abortController = new AbortController();

  try {
    await chat(
      {
        content: text,
        knowledgeBaseId: activeKbId.value || undefined,
        roleId: activeRole.value?.id || undefined,
        sessionId,
      },
      (token: string) => {
        assistantMsg.content += token;
        scrollToBottom();
      },
      async () => {
        isStreaming.value = false;
        abortController = null;
        assistantMsg.id = `a-${Date.now()}`;
        await loadSessions();
      },
      abortController.signal,
      (error: Error) => {
        assistantMsg.content = error.message || $t('page.ai.chat.requestError');
        assistantMsg.id = `a-${Date.now()}`;
        isStreaming.value = false;
        abortController = null;
      },
    );
  } catch (error: unknown) {
    console.error('Failed to send chat message:', error);
    if (!(error instanceof Error && error.name === 'AbortError')) {
      assistantMsg.content =
        assistantMsg.content || $t('page.ai.chat.requestError');
    }
    assistantMsg.id = `a-${Date.now()}`;
    isStreaming.value = false;
    abortController = null;
  }
}

function handleStop() {
  abortController?.abort();
  abortController = null;
  isStreaming.value = false;
}

function handleQuickQuestion(key: string) {
  inputText.value = $t(`page.ai.chat.${key}`);
}

async function regenerate() {
  if (isStreaming.value) return;
  const lastUser = [...messages.value]
    .toReversed()
    .find((m) => m.role === 'user');
  if (!lastUser) return;
  while (messages.value.length > 0) {
    const last = messages.value.at(-1);
    messages.value.pop();
    if (last?.role === 'user') break;
  }
  await scrollToBottom(true);
  inputText.value = lastUser.content;
  await handleSend();
}

const quickQuestions = [
  { key: 'quickQuestion_1', icon: 'lucide:file-text' },
  { key: 'quickQuestion_2', icon: 'lucide:book-open' },
  { key: 'quickQuestion_3', icon: 'lucide:code-2' },
  { key: 'quickQuestion_4', icon: 'lucide:languages' },
];

// ===== 生命周期 =====
onMounted(async () => {
  await Promise.all([loadSessions(), loadRoles(), loadModels()]);
  await loadKnowledgeBases();
  if (sessions.value.length > 0) {
    await selectSession(sessions.value[0]?.id ?? '');
  }
});

function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    createNewSession();
  }
}
onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
  abortController?.abort();
});
</script>

<template>
  <Page auto-content-height content-class="p-4">
    <div class="ym-ai">
      <SessionSidebar
        :active-session-id="activeSessionId"
        :collapsed="!sidebarOpen"
        :loading="sessionsLoading"
        :search="sessionSearch"
        :sessions="sessions"
        @collapse="sidebarOpen = $event"
        @create="createNewSession()"
        @delete="handleDeleteSession"
        @pin="handlePinSession"
        @rename="startRename"
        @search="sessionSearch = $event"
        @select="selectSession"
      />

      <!-- ======================================================
           主区域
      ====================================================== -->
      <div class="ym-ai__main">
        <!-- 顶部标题栏 -->
        <header class="ym-ai__header">
          <div class="ym-ai__header-left">
            <span v-if="activeTitle" class="ym-ai__header-title">{{
              activeTitle
            }}</span>
            <span
              v-else
              class="ym-ai__header-title ym-ai__header-title--placeholder"
            >
              {{ $t('page.ai.chat.newChat') }}
            </span>
          </div>
          <div class="ym-ai__header-right">
            <!-- 当前角色芯片 -->
            <div v-if="activeRole" class="ym-ai__role-chip">
              <span
                class="ym-badge ym-badge--sm"
                :class="roleBadge(activeRole.category).cls"
              >
                {{ roleBadge(activeRole.category).char }}
              </span>
              <span>{{ activeRole.name }}</span>
              <button class="ym-ai__role-chip-close" @click="activeRole = null">
                <svg
                  class="size-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                  stroke-linecap="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <!-- 重新生成 -->
            <Tooltip
              v-if="messages.length > 0 && !isStreaming"
              :title="$t('page.ai.chat.regenerate')"
            >
              <Button size="small" type="text" @click="regenerate">
                <RotateCw class="size-4" />
              </Button>
            </Tooltip>
          </div>
        </header>

        <!-- ===== 欢迎页 ===== -->
        <div v-if="welcomeShown" ref="welcomeRef" class="ym-ai__welcome">
          <div class="ym-ai__welcome-inner">
            <div class="ym-ai__welcome-icon">
              <IconifyIcon icon="lucide:sparkles" class="size-9" />
            </div>
            <h1 class="ym-ai__welcome-title">
              {{ $t('page.ai.chat.welcomeTitle') }}
            </h1>
            <p class="ym-ai__welcome-sub">
              {{ $t('page.ai.chat.welcomeSubtitle') }}
            </p>

            <!-- 角色卡片 -->
            <template v-if="featuredRoles.length > 0">
              <div class="ym-ai__welcome-section-label">
                {{ $t('page.ai.chat.welcomeRole') }}
              </div>
              <div class="ym-ai__welcome-roles">
                <div
                  v-for="role in featuredRoles"
                  :key="role.id"
                  class="ym-ai__role-card"
                  @click="handleNewChatWithRole(role.id)"
                >
                  <span class="ym-badge" :class="roleBadge(role.category).cls">
                    {{ roleBadge(role.category).char }}
                  </span>
                  <span class="ym-ai__role-card-name">{{ role.name }}</span>
                  <span class="ym-ai__role-card-desc">{{
                    role.description
                  }}</span>
                </div>
              </div>
            </template>

            <!-- 快捷问题 -->
            <div class="ym-ai__welcome-section-label">
              {{ $t('page.ai.chat.welcomeQuickQ') }}
            </div>
            <div class="ym-ai__quick-questions">
              <button
                v-for="q in quickQuestions"
                :key="q.key"
                class="ym-ai__quick-q"
                @click="handleQuickQuestion(q.key)"
              >
                {{ $t(`page.ai.chat.${q.key}`) }}
              </button>
            </div>
          </div>
        </div>

        <!-- ===== 空会话提示（选了会话但无消息） ===== -->
        <div v-else-if="emptySessionShown" class="ym-ai__welcome">
          <div class="ym-ai__empty-session">
            <IconifyIcon
              icon="lucide:message-square"
              class="ym-ai__empty-icon"
            />
            <p>{{ $t('page.ai.chat.emptySession') }}</p>
          </div>
        </div>

        <!-- ===== 消息列表 ===== -->
        <MessageList
          v-else
          ref="msgListRef"
          :is-streaming="isStreaming"
          :loading="messagesLoading"
          :messages="messages"
        />

        <!-- ===== 输入区 ===== -->
        <InputBar
          :active-kb-id="activeKbId"
          :active-model-id="activeModelId"
          :active-role-name="activeRole?.name ?? ''"
          :input-text="inputText"
          :is-streaming="isStreaming"
          :knowledge-bases="knowledgeBases"
          :models="models"
          :role-drawer-open="roleDrawerOpen"
          @send="handleSend"
          @stop="handleStop"
          @toggle-role="roleDrawerOpen = !roleDrawerOpen"
          @update:input-text="inputText = $event"
          @update:kb-id="activeKbId = $event"
          @update:model-id="activeModelId = $event"
        />
      </div>

      <!-- ======================================================
           角色选择浮层
      ====================================================== -->
      <RolePicker
        :active-role-id="activeRole?.id ?? ''"
        :category="roleCategory"
        :open="roleDrawerOpen"
        :roles="roles"
        :search="roleSearch"
        @category="roleCategory = $event"
        @close="roleDrawerOpen = false"
        @favorite="toggleFavorite"
        @search="roleSearch = $event"
        @select="selectRole"
      />
    </div>
  </Page>
</template>

<style scoped>
/* ================================================================
   整体容器
================================================================ */
.ym-ai {
  position: relative;
  display: flex;
  height: 100%;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px hsl(var(--foreground) / 6%);
}

/* ================================================================
   主区域
================================================================ */
.ym-ai__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* ===== 顶部标题栏 ===== */
.ym-ai__header {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  height: 50px;
  padding: 0 18px;
  border-bottom: 1px solid hsl(var(--border));
}

.ym-ai__header-left {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.ym-ai__header-right {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
}

.ym-ai__header-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.ym-ai__header-title--placeholder {
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

.ym-ai__role-chip {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 3px 8px 3px 4px;
  font-size: 12px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-radius: 20px;
}

.ym-ai__role-chip-close {
  display: flex;
  align-items: center;
  padding: 0 1px;
  color: inherit;
  cursor: pointer;
  background: none;
  border: none;
  opacity: 0.6;
}

.ym-ai__role-chip-close:hover {
  opacity: 1;
}

/* ================================================================
   欢迎页
================================================================ */
.ym-ai__welcome {
  display: flex;
  flex: 1;
  align-items: flex-start;
  justify-content: center;
  padding: 48px 24px 24px;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.ym-ai__welcome::-webkit-scrollbar {
  display: none;
}

.ym-ai__welcome-inner {
  width: 100%;
  max-width: 640px;
}

.ym-ai__welcome-icon {
  margin-bottom: 12px;
  color: hsl(var(--primary));
  text-align: center;
}

.ym-ai__welcome-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  letter-spacing: -0.5px;
}

.ym-ai__welcome-sub {
  margin: 0 0 28px;
  font-size: 14px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.ym-ai__welcome-section-label {
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.ym-ai__welcome-roles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 24px;
}

.ym-ai__role-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 14px 12px;
  cursor: pointer;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.ym-ai__role-card:hover {
  border-color: hsl(var(--primary) / 50%);
  box-shadow: 0 2px 8px hsl(var(--primary) / 10%);
}

.ym-ai__role-card-name {
  font-size: 13px;
  font-weight: 600;
}

.ym-ai__role-card-desc {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.ym-ai__quick-questions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.ym-ai__quick-q {
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.4;
  color: hsl(var(--foreground));
  text-align: left;
  cursor: pointer;
  background: hsl(var(--muted) / 50%);
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  transition:
    background 0.12s,
    border-color 0.12s;
}

.ym-ai__quick-q:hover {
  background: hsl(var(--muted));
  border-color: hsl(var(--primary) / 40%);
}

/* 空会话提示 */
.ym-ai__empty-session {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.ym-ai__empty-icon {
  font-size: 32px;
  opacity: 0.4;
}
</style>
