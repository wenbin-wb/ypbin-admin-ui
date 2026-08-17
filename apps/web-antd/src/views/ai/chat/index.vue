<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Menu, Plus, RotateCw, Search, Square, X } from '@vben/icons';

import {
  Button,
  Input,
  message,
  Popconfirm,
  Select,
  Tooltip,
} from 'ant-design-vue';
import hljs from 'highlight.js';
import { marked } from 'marked';

import {
  chat,
  createSession,
  deleteSession,
  getKnowledgeBaseList,
  getModelList,
  getRoleList,
  getSessionList,
  getSessionMessages,
  toggleRoleFavorite,
  toggleSessionPin,
  updateSessionTitle,
} from '#/api/ai';
import { $t } from '#/locales';
import { sanitizeHtml } from '#/views/system/_shared/sanitize';

defineOptions({ name: 'AiChat' });

// ===== Markdown 渲染（流式增量，代码块即时高亮） =====
const markdownRenderer = new marked.Renderer();
markdownRenderer.code = ({ text, lang }: { lang?: string; text: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre class="ai-code-block" data-lang="${language}"><button type="button" class="ai-copy-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>${$t('page.ai.chat.copy')}</button><code class="hljs language-${language}">${highlighted}</code></pre>`;
};
marked.use({
  async: false,
  breaks: true,
  gfm: true,
  renderer: markdownRenderer,
});

// ===== 状态 =====
const sidebarOpen = ref(true);
const sessions = ref<AiApi.ChatSession[]>([]);
const activeSessionId = ref('');
const messages = ref<AiApi.ChatMessage[]>([]);
const inputText = ref('');
const isStreaming = ref(false);
const sessionsLoading = ref(false);
const messagesLoading = ref(false);
const sessionSearch = ref('');

// 角色
const roles = ref<AiApi.ChatRole[]>([]);
const activeRole = ref<AiApi.ChatRole | null>(null);
const roleDrawerOpen = ref(false);
const roleSearch = ref('');
const roleCategory = ref<string>('all');

// 模型
const models = ref<AiApi.ModelConfig[]>([]);
const activeModelId = ref('');

// 知识库（RAG）
const knowledgeBases = ref<AiApi.KnowledgeBase[]>([]);
const activeKbId = ref('');

const msgListRef = ref<HTMLElement>();
const welcomeRef = ref<HTMLElement>();
let abortController: AbortController | null = null;

// ===== 会话搜索 + 时间分组 =====
const filteredSessions = computed(() => {
  const kw = sessionSearch.value.trim().toLowerCase();
  if (!kw) return sessions.value;
  return sessions.value.filter((s) => s.title.toLowerCase().includes(kw));
});

type SessionGroup = { items: AiApi.ChatSession[]; key: string; label: string };

const sessionGroups = computed((): SessionGroup[] => {
  const pinned: AiApi.ChatSession[] = [];
  const today: AiApi.ChatSession[] = [];
  const week: AiApi.ChatSession[] = [];
  const month: AiApi.ChatSession[] = [];
  const older: AiApi.ChatSession[] = [];

  const now = Date.now();
  const DAY = 86_400_000;

  for (const s of filteredSessions.value) {
    if (s.isPinned === 1) {
      pinned.push(s);
      continue;
    }
    const t = new Date(s.lastMessageAt ?? s.createTime).getTime();
    const diff = now - t;
    if (diff < DAY) today.push(s);
    else if (diff < 7 * DAY) week.push(s);
    else if (diff < 30 * DAY) month.push(s);
    else older.push(s);
  }

  const groups: SessionGroup[] = [];
  if (pinned.length > 0)
    groups.push({
      label: $t('page.ai.chat.groupPinned'),
      key: 'pinned',
      items: pinned,
    });
  if (today.length > 0)
    groups.push({
      label: $t('page.ai.chat.groupToday'),
      key: 'today',
      items: today,
    });
  if (week.length > 0)
    groups.push({
      label: $t('page.ai.chat.group7Days'),
      key: 'week',
      items: week,
    });
  if (month.length > 0)
    groups.push({
      label: $t('page.ai.chat.group30Days'),
      key: 'month',
      items: month,
    });
  if (older.length > 0)
    groups.push({
      label: $t('page.ai.chat.groupOlder'),
      key: 'older',
      items: older,
    });
  return groups;
});

// ===== 角色筛选（修复分类逻辑） =====
const roleCategories = [
  'all',
  'favorite',
  'assistant',
  'translator',
  'coder',
  'analyst',
  'writer',
  'custom',
];

const filteredRoles = computed(() => {
  const kw = roleSearch.value.trim().toLowerCase();
  return roles.value.filter((role) => {
    const cat = roleCategory.value;
    let matchesCategory: boolean;
    if (cat === 'all') matchesCategory = true;
    else if (cat === 'favorite') matchesCategory = Boolean(role.isFavorite);
    else if (cat === 'custom') matchesCategory = role.isBuiltin === 0;
    else matchesCategory = role.category === cat;
    const matchesSearch =
      !kw ||
      role.name.toLowerCase().includes(kw) ||
      (role.description ?? '').toLowerCase().includes(kw);
    return matchesCategory && matchesSearch;
  });
});

const featuredRoles = computed(() =>
  roles.value.filter((r) => r.isBuiltin === 1).slice(0, 4),
);

const quickQuestions = [
  { key: 'quickQuestion_1', icon: 'lucide:file-text' },
  { key: 'quickQuestion_2', icon: 'lucide:book-open' },
  { key: 'quickQuestion_3', icon: 'lucide:code-2' },
  { key: 'quickQuestion_4', icon: 'lucide:languages' },
];

// ===== 会话 =====
async function loadSessions() {
  sessionsLoading.value = true;
  try {
    sessions.value = await getSessionList();
  } finally {
    sessionsLoading.value = false;
  }
}

async function createNewSession(roleId?: string) {
  if (roleId) {
    activeRole.value = roles.value.find((r) => r.id === roleId) ?? null;
  }
  activeSessionId.value = '';
  messages.value = [];
  roleDrawerOpen.value = false;
  inputText.value = '';
}

async function selectSession(id: string) {
  if (isStreaming.value || activeSessionId.value === id) return;
  activeSessionId.value = id;
  roleDrawerOpen.value = false;
  messages.value = [];
  messagesLoading.value = true;
  try {
    messages.value = await getSessionMessages(id);
  } catch {
    messages.value = [];
  } finally {
    messagesLoading.value = false;
  }
  await scrollToBottom(true);
}

async function handleDeleteSession(id: string) {
  await deleteSession(id);
  sessions.value = sessions.value.filter((s) => s.id !== id);
  if (activeSessionId.value === id) {
    activeSessionId.value = '';
    messages.value = [];
  }
}

async function handlePinSession(id: string) {
  await toggleSessionPin(id);
  // 本地切换置顶状态，不重载消息
  const session = sessions.value.find((s) => s.id === id);
  if (session) session.isPinned = session.isPinned === 1 ? 0 : 1;
  // 排序：置顶的浮到顶
  sessions.value = [
    ...sessions.value.filter((s) => s.isPinned === 1),
    ...sessions.value.filter((s) => s.isPinned !== 1),
  ];
}

// 重命名
const renamingId = ref('');
const renameTitle = ref('');
function startRename(id: string, title: string) {
  renamingId.value = id;
  renameTitle.value = title;
}
async function commitRename(id: string) {
  const t = renameTitle.value.trim();
  if (!t) {
    renamingId.value = '';
    return;
  }
  await updateSessionTitle(id, t);
  const session = sessions.value.find((s) => s.id === id);
  if (session) session.title = t;
  renamingId.value = '';
}

// ===== 角色 =====
async function loadRoles() {
  roles.value = await getRoleList();
}

function selectRole(role: AiApi.ChatRole) {
  activeRole.value = role;
  // 应用角色偏好模型
  if (role.modelPreference) {
    const m = models.value.find((x) => x.modelName === role.modelPreference);
    if (m) activeModelId.value = m.id;
  }
  roleDrawerOpen.value = false;
}

async function handleNewChatWithRole(roleId: string) {
  roleDrawerOpen.value = false;
  await createNewSession(roleId);
}

async function toggleFavorite(role: AiApi.ChatRole, e: Event) {
  e.stopPropagation();
  await toggleRoleFavorite(role.id);
  role.isFavorite = !role.isFavorite;
}

// ===== 模型 =====
async function loadModels() {
  try {
    models.value = await getModelList();
    const def = models.value.find((m) => m.isDefault === 1);
    if (def) activeModelId.value = def.id;
  } catch {
    // 模型未配置时不展示选择器
  }
}

// ===== 发送 =====
async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value) return;

  let sessionId = activeSessionId.value;
  if (!sessionId) {
    sessionId = await createSession({
      roleId: activeRole.value?.id || undefined,
      modelId: activeModelId.value || undefined,
    });
    await loadSessions();
    activeSessionId.value = sessionId;
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
        conversationId: sessionId,
        message: text,
        knowledgeBaseId: activeKbId.value || undefined,
        promptTemplateId: activeRole.value?.id || undefined,
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

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function handleQuickQuestion(key: string) {
  inputText.value = $t(`page.ai.chat.${key}`);
}

// ===== 消息操作 =====
async function copyMessage(content: string) {
  try {
    await navigator.clipboard.writeText(content);
    message.success($t('page.ai.chat.copied'));
  } catch {
    message.warning($t('common.requestFailed'));
  }
}

const liked = ref<Record<string, 'down' | 'up' | undefined>>({});
function toggleLike(id: string, type: 'down' | 'up') {
  liked.value[id] = liked.value[id] === type ? undefined : type;
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

// ===== Markdown =====
function renderMd(content: string): string {
  if (!content) return '';
  try {
    const raw = marked.parse(content);
    if (typeof raw !== 'string') return content;
    return sanitizeHtml(raw);
  } catch {
    return content;
  }
}

function isErrorText(content: string): boolean {
  return (
    content.startsWith('对话出错：') || content.startsWith('Request failed')
  );
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
    .catch(() => {});
}

// ===== 工具函数 =====
const activeTitle = computed(
  () => sessions.value.find((s) => s.id === activeSessionId.value)?.title ?? '',
);

const welcomeShown = computed(
  () => messages.value.length === 0 && !messagesLoading.value,
);

const ROLE_MARKS: Record<string, { char: string; cls: string }> = {
  analyst: { char: '析', cls: 'role-analyst' },
  coder: { char: '码', cls: 'role-coder' },
  custom: { char: '自', cls: 'role-custom' },
  translator: { char: '译', cls: 'role-translator' },
  writer: { char: '写', cls: 'role-writer' },
};

function roleMark(category?: string): { char: string; cls: string } {
  return ROLE_MARKS[category ?? ''] ?? { char: 'AI', cls: 'role-assistant' };
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

// ===== 生命周期 =====
onMounted(async () => {
  await Promise.all([loadSessions(), loadRoles(), loadModels()]);
  try {
    knowledgeBases.value = await getKnowledgeBaseList();
  } catch {
    /* optional */
  }
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

async function scrollToBottom(force = false) {
  await nextTick();
  const el = msgListRef.value ?? welcomeRef.value;
  if (!el) return;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  if (force || nearBottom) el.scrollTop = el.scrollHeight;
}
</script>

<template>
  <Page auto-content-height content-class="p-4">
    <div class="ym-ai">
      <!-- ======================================================
           左侧侧边栏
      ====================================================== -->
      <aside
        class="ym-ai__sidebar"
        :class="{ 'ym-ai__sidebar--collapsed': !sidebarOpen }"
      >
        <!-- 头部：Logo + 展开/收起 -->
        <div class="ym-ai__sidebar-top">
          <div class="ym-ai__logo">
            <span class="ym-ai__logo-icon">✦</span>
            <span v-show="sidebarOpen" class="ym-ai__logo-text">Ypbin AI</span>
          </div>
          <Button
            size="small"
            type="text"
            class="ym-ai__collapse-btn"
            :title="sidebarOpen ? '收起' : '展开'"
            @click="sidebarOpen = !sidebarOpen"
          >
            <Menu class="size-4" />
          </Button>
        </div>

        <!-- 新建对话按钮 -->
        <div class="ym-ai__sidebar-new">
          <Button
            v-access:code="['ai:chat:create']"
            class="ym-ai__new-btn"
            type="primary"
            block
            @click="createNewSession()"
          >
            <Plus class="size-4" />
            <span v-show="sidebarOpen">{{ $t('page.ai.chat.newChat') }}</span>
          </Button>
        </div>

        <!-- 搜索框（仅展开态） -->
        <div v-show="sidebarOpen" class="ym-ai__sidebar-search">
          <Input
            v-model:value="sessionSearch"
            :placeholder="$t('page.ai.chat.searchSessions')"
            allow-clear
            size="small"
          >
            <template #prefix>
              <Search class="size-3.5 text-muted-foreground" />
            </template>
          </Input>
        </div>

        <!-- 会话列表（分组） -->
        <div class="ym-ai__session-list">
          <!-- 无会话 -->
          <div v-if="sessionsLoading" class="ym-ai__session-loading">
            <div v-for="i in 4" :key="i" class="ym-ai__session-skeleton"></div>
          </div>
          <div
            v-else-if="filteredSessions.length === 0"
            class="ym-ai__session-empty"
          >
            <span v-if="sessionSearch">{{
              $t('page.ai.chat.searchEmpty')
            }}</span>
            <span v-else>{{ $t('page.ai.chat.noSessions') }}</span>
          </div>
          <template v-else>
            <div
              v-for="group in sessionGroups"
              :key="group.key"
              class="ym-ai__group"
            >
              <div v-show="sidebarOpen" class="ym-ai__group-label">
                {{ group.label }}
              </div>
              <div
                v-for="session in group.items"
                :key="session.id"
                class="ym-ai__session-item"
                :class="{
                  'ym-ai__session-item--active': session.id === activeSessionId,
                  'ym-ai__session-item--pinned': session.isPinned === 1,
                }"
                @click="selectSession(session.id)"
              >
                <!-- 置顶图标（仅折叠时显示） -->
                <span
                  v-if="!sidebarOpen && session.isPinned === 1"
                  class="ym-ai__session-pin-dot"
                ></span>

                <!-- 重命名输入 -->
                <Input
                  v-if="renamingId === session.id"
                  v-model:value="renameTitle"
                  size="small"
                  autofocus
                  @click.stop
                  @blur="commitRename(session.id)"
                  @press-enter="commitRename(session.id)"
                />

                <template v-else>
                  <div class="ym-ai__session-body" :title="session.title">
                    <span
                      v-if="session.isPinned === 1 && sidebarOpen"
                      class="ym-ai__pin-icon"
                      title="已置顶"
                    >
                      <svg
                        class="size-2.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <line
                          x1="12"
                          x2="12"
                          y1="17"
                          y2="22"
                          stroke="currentColor"
                          stroke-width="2"
                        />
                        <path
                          d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"
                          stroke="currentColor"
                          stroke-width="2"
                          fill="none"
                        />
                      </svg>
                    </span>
                    <span v-show="sidebarOpen" class="ym-ai__session-title">{{
                      session.title
                    }}</span>
                  </div>

                  <!-- 操作按钮（hover 时显示） -->
                  <div v-show="sidebarOpen" class="ym-ai__session-actions">
                    <Tooltip
                      :title="
                        session.isPinned === 1
                          ? $t('page.ai.chat.unpinSession')
                          : $t('page.ai.chat.pinSession')
                      "
                    >
                      <Button
                        size="small"
                        type="text"
                        @click.stop="handlePinSession(session.id)"
                      >
                        <svg
                          class="size-3"
                          :fill="
                            session.isPinned === 1 ? 'currentColor' : 'none'
                          "
                          stroke="currentColor"
                          stroke-width="2"
                          viewBox="0 0 24 24"
                        >
                          <line x1="12" x2="12" y1="17" y2="22" />
                          <path
                            d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"
                          />
                        </svg>
                      </Button>
                    </Tooltip>
                    <Tooltip :title="$t('page.ai.chat.renameSession')">
                      <Button
                        size="small"
                        type="text"
                        @click.stop="startRename(session.id, session.title)"
                      >
                        <svg
                          class="size-3"
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
                    </Tooltip>
                    <Popconfirm
                      :title="$t('page.ai.chat.confirmDelete')"
                      @confirm="handleDeleteSession(session.id)"
                    >
                      <Button size="small" danger type="text" @click.stop>
                        <svg
                          class="size-3"
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
                  </div>
                </template>
              </div>
            </div>
          </template>
        </div>
      </aside>

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
                :class="roleMark(activeRole.category).cls"
              >
                {{ roleMark(activeRole.category).char }}
              </span>
              <span>{{ activeRole.name }}</span>
              <button class="ym-ai__role-chip-close" @click="activeRole = null">
                <X class="size-3" />
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
            <div class="ym-ai__welcome-icon">✦</div>
            <h1 class="ym-ai__welcome-title">
              {{ $t('page.ai.chat.welcomeTitle') }}
            </h1>
            <p class="ym-ai__welcome-sub">
              {{ $t('page.ai.chat.welcomeSubtitle') }}
            </p>

            <!-- 角色卡片 -->
            <div
              v-if="featuredRoles.length > 0"
              class="ym-ai__welcome-section-label"
            >
              {{ $t('page.ai.chat.welcomeRole') }}
            </div>
            <div class="ym-ai__welcome-roles">
              <div
                v-for="role in featuredRoles"
                :key="role.id"
                class="ym-ai__role-card"
                @click="handleNewChatWithRole(role.id)"
              >
                <span class="ym-badge" :class="roleMark(role.category).cls">
                  {{ roleMark(role.category).char }}
                </span>
                <span class="ym-ai__role-card-name">{{ role.name }}</span>
                <span class="ym-ai__role-card-desc">{{
                  role.description
                }}</span>
              </div>
            </div>

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

        <!-- ===== 消息列表 ===== -->
        <div v-else ref="msgListRef" class="ym-ai__messages">
          <!-- 加载骨架 -->
          <div v-if="messagesLoading" class="ym-ai__msg-loading">
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
                <div class="ym-ai__msg-avatar ym-ai__msg-avatar--ai">✦</div>
                <div class="ym-ai__msg-body">
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <div
                    v-if="msg.content"
                    class="ym-ai__markdown"
                    :class="{
                      'ym-ai__markdown--error': isErrorText(msg.content),
                    }"
                    v-html="renderMd(msg.content)"
                    @click="handleMarkdownClick"
                  ></div>
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
                    <button
                      class="ym-ai__action"
                      :class="{
                        'ym-ai__action--active': liked[msg.id] === 'up',
                      }"
                      :title="$t('page.ai.chat.thumbUp')"
                      @click="toggleLike(msg.id, 'up')"
                    >
                      <svg
                        class="size-3.5"
                        :fill="liked[msg.id] === 'up' ? 'currentColor' : 'none'"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                        stroke-linecap="round"
                      >
                        <path
                          d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
                        />
                      </svg>
                    </button>
                    <button
                      class="ym-ai__action"
                      :class="{
                        'ym-ai__action--active': liked[msg.id] === 'down',
                      }"
                      :title="$t('page.ai.chat.thumbDown')"
                      @click="toggleLike(msg.id, 'down')"
                    >
                      <svg
                        class="size-3.5"
                        :fill="
                          liked[msg.id] === 'down' ? 'currentColor' : 'none'
                        "
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                        stroke-linecap="round"
                      >
                        <path
                          d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
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

              <!-- 用户消息 -->
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
                <div class="ym-ai__msg-avatar ym-ai__msg-avatar--user">我</div>
              </template>
            </div>
          </template>
        </div>

        <!-- ===== 输入区 ===== -->
        <div class="ym-ai__input-wrap">
          <div class="ym-ai__input-box">
            <Input.TextArea
              v-model:value="inputText"
              :placeholder="$t('page.ai.chat.placeholder')"
              :auto-size="{ minRows: 1, maxRows: 6 }"
              class="ym-ai__textarea"
              @keydown="handleKeydown"
            />
            <div class="ym-ai__input-toolbar">
              <!-- 左侧工具 -->
              <div class="ym-ai__tools-left">
                <!-- 角色选择 -->
                <Tooltip :title="$t('page.ai.chat.selectRole')">
                  <button
                    class="ym-ai__tool-btn"
                    :class="{ 'ym-ai__tool-btn--active': roleDrawerOpen }"
                    @click="roleDrawerOpen = !roleDrawerOpen"
                  >
                    <svg
                      class="size-4"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      viewBox="0 0 24 24"
                      stroke-linecap="round"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path
                        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                      />
                    </svg>
                    <span v-if="activeRole" class="ym-ai__tool-label">{{
                      activeRole.name
                    }}</span>
                  </button>
                </Tooltip>
                <!-- 知识库 -->
                <Tooltip
                  v-if="knowledgeBases.length > 0"
                  :title="$t('page.ai.chat.attachKb')"
                >
                  <Select
                    v-model:value="activeKbId"
                    :options="[
                      { label: '不关联知识库', value: '' },
                      ...knowledgeBases.map((kb) => ({
                        label: `${kb.icon || '📚'} ${kb.name}`,
                        value: kb.id,
                      })),
                    ]"
                    size="small"
                    class="ym-ai__kb-select"
                    :bordered="false"
                    placeholder="关联知识库…"
                  />
                </Tooltip>
                <!-- 模型 -->
                <Select
                  v-if="models.length > 1"
                  v-model:value="activeModelId"
                  :options="
                    models
                      .filter((m) => m.modelType === 'CHAT' || !m.modelType)
                      .map((m) => ({ label: m.modelName, value: m.id }))
                  "
                  size="small"
                  class="ym-ai__model-select"
                  :bordered="false"
                />
              </div>
              <!-- 右侧：发送/停止 -->
              <div class="ym-ai__tools-right">
                <span class="ym-ai__enter-tip">{{
                  $t('page.ai.chat.enterTip')
                }}</span>
                <Button
                  v-if="isStreaming"
                  class="ym-ai__send-btn ym-ai__send-btn--stop"
                  type="primary"
                  danger
                  @click="handleStop"
                >
                  <Square class="size-3.5" />
                  {{ $t('page.ai.chat.stop') }}
                </Button>
                <Button
                  v-else
                  class="ym-ai__send-btn"
                  type="primary"
                  :disabled="!inputText.trim()"
                  @click="handleSend"
                >
                  {{ $t('page.ai.chat.send') }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ======================================================
           角色选择浮层
      ====================================================== -->
      <Transition name="ym-role">
        <div
          v-if="roleDrawerOpen"
          class="ym-role-overlay"
          @click.self="roleDrawerOpen = false"
        >
          <div class="ym-role-panel">
            <div class="ym-role-header">
              <span class="ym-role-title">{{
                $t('page.ai.chat.selectRole')
              }}</span>
              <Button size="small" type="text" @click="roleDrawerOpen = false">
                <X class="size-4" />
              </Button>
            </div>

            <!-- 分类 Tab -->
            <div class="ym-role-cats">
              <button
                v-for="cat in roleCategories"
                :key="cat"
                class="ym-role-cat"
                :class="{ active: roleCategory === cat }"
                @click="roleCategory = cat"
              >
                {{
                  cat === 'all'
                    ? $t('page.ai.chat.roleAll')
                    : cat === 'favorite'
                      ? $t('page.ai.chat.roleFavorite')
                      : cat === 'custom'
                        ? $t('page.ai.chat.roleCustom')
                        : $t(`page.ai.chat.roleCategory_${cat}`)
                }}
              </button>
            </div>

            <!-- 搜索 -->
            <div class="ym-role-search">
              <Input
                v-model:value="roleSearch"
                :placeholder="$t('page.ai.chat.rolePlaceholder')"
                allow-clear
                size="small"
              />
            </div>

            <!-- 角色列表 -->
            <div class="ym-role-list">
              <div
                v-for="role in filteredRoles"
                :key="role.id"
                class="ym-role-item"
                :class="{ active: activeRole?.id === role.id }"
                @click="selectRole(role)"
              >
                <span class="ym-badge" :class="roleMark(role.category).cls">
                  {{ roleMark(role.category).char }}
                </span>
                <div class="ym-role-info">
                  <span class="ym-role-name">{{ role.name }}</span>
                  <span class="ym-role-desc">{{ role.description }}</span>
                </div>
                <button
                  class="ym-role-fav"
                  :class="{ active: role.isFavorite }"
                  :title="role.isFavorite ? '取消收藏' : '收藏'"
                  @click.stop="toggleFavorite(role, $event)"
                >
                  <svg
                    class="size-4"
                    :fill="role.isFavorite ? 'currentColor' : 'none'"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                  >
                    <polygon
                      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    />
                  </svg>
                </button>
              </div>
              <div v-if="filteredRoles.length === 0" class="ym-role-empty">
                {{
                  roleCategory === 'favorite'
                    ? '还没有收藏的角色'
                    : '暂无匹配角色'
                }}
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Page>
</template>

<style scoped>
/* ================================================================
   整体容器
================================================================ */
.ym-ai {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px hsl(var(--foreground) / 6%);
}

/* ================================================================
   侧边栏
================================================================ */
.ym-ai__sidebar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 260px;
  overflow: hidden;
  background: hsl(var(--secondary) / 25%);
  border-right: 1px solid hsl(var(--border));
  transition: width 0.22s ease;
}

.ym-ai__sidebar--collapsed {
  width: 56px;
}

.ym-ai__sidebar-top {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 8px;
}

.ym-ai__logo {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}

.ym-ai__logo-icon {
  flex-shrink: 0;
  font-size: 20px;
  color: hsl(var(--primary));
  animation: ym-pulse 4s ease-in-out infinite;
}

@keyframes ym-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.ym-ai__logo-text {
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
  white-space: nowrap;
}

.ym-ai__collapse-btn {
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.ym-ai__collapse-btn:hover {
  opacity: 1;
}

.ym-ai__sidebar-new {
  padding: 0 10px 8px;
}

.ym-ai__new-btn {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  font-weight: 500;
}

.ym-ai__sidebar-search {
  padding: 0 10px 8px;
}

/* ===== 会话列表 ===== */
.ym-ai__session-list {
  flex: 1;
  min-height: 0;
  padding: 4px 6px;
  overflow-y: auto;
  scrollbar-width: none;
}

.ym-ai__session-list::-webkit-scrollbar {
  display: none;
}

.ym-ai__session-loading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px;
}

.ym-ai__session-skeleton {
  height: 32px;
  background: hsl(var(--muted));
  border-radius: 8px;
  animation: ym-shimmer 1.4s ease infinite;
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

.ym-ai__session-empty {
  padding: 24px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.ym-ai__group-label {
  padding: 10px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.ym-ai__session-item {
  position: relative;
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  padding: 7px 8px;
  margin-bottom: 1px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.12s;
}

.ym-ai__session-item:hover {
  background: hsl(var(--muted) / 70%);
}

.ym-ai__session-item--active {
  background: hsl(var(--primary) / 10%);
}

.ym-ai__session-item--active .ym-ai__session-title {
  font-weight: 500;
  color: hsl(var(--primary));
}

.ym-ai__session-pin-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  margin: auto;
  background: hsl(var(--primary));
  border-radius: 50%;
}

.ym-ai__session-body {
  display: flex;
  flex: 1;
  gap: 4px;
  align-items: center;
  min-width: 0;
}

.ym-ai__pin-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  color: hsl(var(--primary));
}

.ym-ai__session-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.ym-ai__session-actions {
  display: flex;
  flex-shrink: 0;
  gap: 1px;
  opacity: 0;
  transition: opacity 0.15s;
}

.ym-ai__session-item:hover .ym-ai__session-actions {
  opacity: 1;
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
  font-size: 36px;
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

/* 消息行 */
.ym-ai__msg {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  max-width: 100%;
}

.ym-ai__msg--user {
  flex-direction: row-reverse;
  justify-content: flex-start;
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
  font-size: 16px;
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
  flex: 1;
  min-width: 0;
  max-width: min(680px, calc(100% - 42px));
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

.ym-ai__action--active {
  color: hsl(var(--primary)) !important;
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

/* ================================================================
   输入区
================================================================ */
.ym-ai__input-wrap {
  flex-shrink: 0;
  padding: 12px 16px 14px;
  border-top: 1px solid hsl(var(--border));
}

.ym-ai__input-box {
  padding: 10px 12px 8px;
  background: hsl(var(--background));
  border: 1.5px solid hsl(var(--border));
  border-radius: 12px;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.ym-ai__input-box:focus-within {
  border-color: hsl(var(--primary) / 60%);
  box-shadow: 0 0 0 3px hsl(var(--primary) / 8%);
}

.ym-ai__textarea {
  width: 100% !important;
  padding: 0 !important;
  font-size: 14px !important;
  resize: none !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.ym-ai__input-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.ym-ai__tools-left {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.ym-ai__tools-right {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
}

.ym-ai__tool-btn {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 3px 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  transition:
    background 0.12s,
    border-color 0.12s,
    color 0.12s;
}

.ym-ai__tool-btn:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
}

.ym-ai__tool-btn--active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary) / 30%);
}

.ym-ai__tool-label {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ym-ai__kb-select {
  width: 160px;
  font-size: 12px;
}

.ym-ai__model-select {
  width: 140px;
  font-size: 12px;
}

.ym-ai__enter-tip {
  font-size: 11px;
  color: hsl(var(--muted-foreground) / 70%);
}

.ym-ai__send-btn {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  font-weight: 500;
}

/* ================================================================
   角色徽章（ym-badge）
================================================================ */
.ym-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 11px;
  font-weight: 700;
  user-select: none;
  border-radius: 8px;
}

.ym-badge--sm {
  width: 20px;
  height: 20px;
  font-size: 10px;
  border-radius: 5px;
}

.role-assistant {
  color: hsl(221deg 83% 53%);
  background: hsl(221deg 83% 53% / 15%);
}

.role-translator {
  color: hsl(142deg 71% 45%);
  background: hsl(142deg 71% 45% / 15%);
}

.role-coder {
  color: hsl(262deg 83% 58%);
  background: hsl(262deg 83% 58% / 15%);
}

.role-analyst {
  color: hsl(24deg 95% 53%);
  background: hsl(24deg 95% 53% / 15%);
}

.role-writer {
  color: hsl(340deg 82% 52%);
  background: hsl(340deg 82% 52% / 15%);
}

.role-custom {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

/* ================================================================
   角色选择浮层
================================================================ */
.ym-role-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: hsl(var(--foreground) / 20%);
  backdrop-filter: blur(2px);
}

.ym-role-panel {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  max-height: 72vh;
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -8px 32px hsl(var(--foreground) / 8%);
}

.ym-role-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 8px;
  border-bottom: 1px solid hsl(var(--border));
}

.ym-role-title {
  font-size: 15px;
  font-weight: 700;
}

.ym-role-cats {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  padding: 10px 16px 6px;
  overflow-x: auto;
  scrollbar-width: none;
}

.ym-role-cats::-webkit-scrollbar {
  display: none;
}

.ym-role-cat {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
  cursor: pointer;
  background: hsl(var(--muted) / 50%);
  border: 1px solid hsl(var(--border));
  border-radius: 20px;
  transition:
    background 0.12s,
    border-color 0.12s;
}

.ym-role-cat.active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 15%);
  border-color: hsl(var(--primary) / 40%);
}

.ym-role-search {
  flex-shrink: 0;
  padding: 6px 12px;
}

.ym-role-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  padding: 4px 10px 12px;
  overflow-y: auto;
  scrollbar-width: none;
}

.ym-role-list::-webkit-scrollbar {
  display: none;
}

.ym-role-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 9px 10px;
  cursor: pointer;
  border-radius: 10px;
  transition: background 0.12s;
}

.ym-role-item:hover {
  background: hsl(var(--muted) / 60%);
}

.ym-role-item.active {
  outline: 1px solid hsl(var(--primary) / 25%);
  background: hsl(var(--primary) / 8%);
}

.ym-role-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ym-role-name {
  font-size: 13px;
  font-weight: 600;
}

.ym-role-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.ym-role-fav {
  display: flex;
  flex-shrink: 0;
  padding: 4px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 5px;
  transition:
    color 0.12s,
    background 0.12s;
}

.ym-role-fav:hover {
  background: hsl(var(--muted));
}

.ym-role-fav.active {
  color: hsl(40deg 90% 55%);
}

.ym-role-empty {
  padding: 24px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

/* ================================================================
   角色浮层动效
================================================================ */
.ym-role-enter-active,
.ym-role-leave-active {
  transition: opacity 0.2s;
}

.ym-role-enter-active .ym-role-panel,
.ym-role-leave-active .ym-role-panel {
  transition: transform 0.22s ease;
}

.ym-role-enter-from,
.ym-role-leave-to {
  opacity: 0;
}

.ym-role-enter-from .ym-role-panel,
.ym-role-leave-to .ym-role-panel {
  transform: translateY(100%);
}
</style>

<style>
/* 代码块全局样式 */
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

/* 隐藏滚动条 */
.ym-ai__messages,
.ym-ai__session-list,
.ym-ai__welcome,
.ym-role-list {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.ym-ai__messages::-webkit-scrollbar,
.ym-ai__session-list::-webkit-scrollbar,
.ym-ai__welcome::-webkit-scrollbar,
.ym-role-list::-webkit-scrollbar {
  display: none;
}
</style>
