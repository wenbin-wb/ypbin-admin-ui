<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';

import { Menu, Plus, RotateCw, Search, Square, X } from '@vben/icons';

import {
  Button,
  Input,
  message,
  Popconfirm,
  Select,
  Tooltip,
} from 'ant-design-vue';
import DOMPurify from 'dompurify';
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

defineOptions({ name: 'AiChat' });

// ===== marked + highlight.js（流式增量渲染，代码块在流式结束后再高亮） =====
const markdownRenderer = new marked.Renderer();
markdownRenderer.code = ({ text, lang }: { lang?: string; text: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const safeCode = DOMPurify.sanitize(text, { FORBID_TAGS: ['script'] });
  const highlighted = hljs.highlight(safeCode, { language }).value;
  return `<pre class="ai-code-block"><code class="hljs language-${language}">${highlighted}</code><button type="button" class="ai-copy-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>${$t('page.ai.chat.copy')}</button></pre>`;
};
marked.use({ breaks: true, gfm: true, renderer: markdownRenderer });

// ===== 状态 =====
const sidebarOpen = ref(true);
const sessions = ref<AiApi.ChatSession[]>([]);
const activeSessionId = ref<string>('');
const messages = ref<AiApi.ChatMessage[]>([]);
const inputText = ref('');
const isStreaming = ref(false);

// 角色
const roles = ref<AiApi.ChatRole[]>([]);
const activeRole = ref<AiApi.ChatRole | null>(null);
const roleDrawerOpen = ref(false);
const roleSearch = ref('');
const roleCategory = ref('all');

// 模型
const models = ref<AiApi.ModelConfig[]>([]);
const activeModelId = ref<string>('');

// 知识库（RAG）
const knowledgeBases = ref<AiApi.KnowledgeBase[]>([]);
const activeKbId = ref<string>('');

const msgListRef = ref<HTMLElement>();
const welcomeRef = ref<HTMLElement>();
let abortController: AbortController | null = null;

// ===== 角色筛选 =====
const roleCategories = [
  'all',
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
    const matchesCategory =
      roleCategory.value === 'all' || roleCategory.value === 'custom'
        ? role.isBuiltin === 0
        : (roleCategory.value === 'assistant' &&
            role.isBuiltin === 1 &&
            role.category === 'assistant') ||
          role.category === roleCategory.value;
    const matchesSearch =
      !kw ||
      role.name.toLowerCase().includes(kw) ||
      (role.description ?? '').toLowerCase().includes(kw);
    return matchesCategory && matchesSearch;
  });
});

const featuredRoles = computed(() => {
  // 欢迎页展示前 4 个内置角色
  return roles.value.filter((r) => r.isBuiltin === 1).slice(0, 4);
});

const quickQuestions = [
  { key: 'quickQuestion_1', icon: 'lucide:file-text' },
  { key: 'quickQuestion_2', icon: 'lucide:book-open' },
  { key: 'quickQuestion_3', icon: 'lucide:code-2' },
  { key: 'quickQuestion_4', icon: 'lucide:languages' },
];

// ===== 会话 =====
async function loadSessions() {
  sessions.value = await getSessionList();
}

async function createNewSession(roleId?: string) {
  // 只重置客户端为空会话状态，暂不落库（避免一点"新对话"就生成一堆废会话）；
  // 真正发送首条消息时才由 handleSend 创建会话。
  if (roleId) {
    activeRole.value = roles.value.find((r) => r.id === roleId) ?? null;
  }
  activeSessionId.value = '';
  messages.value = [];
  roleDrawerOpen.value = false;
  inputText.value = '';
}

async function selectSession(id: string) {
  if (isStreaming.value) return;
  if (activeSessionId.value === id) return;
  activeSessionId.value = id;
  roleDrawerOpen.value = false;
  activeRole.value = null; // 会话自带角色由后端 memory 维护
  try {
    messages.value = await getSessionMessages(id);
    // 从会话恢复知识库关联
    const session = sessions.value.find((s) => s.id === id);
    if (session) {
      // 角色留在会话记录中
    }
  } catch {
    messages.value = [];
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
  await scrollToBottom(true);
}

async function handlePinSession(id: string) {
  await toggleSessionPin(id);
  const session = sessions.value.find((s) => s.id === id);
  if (session) session.isPinned = session.isPinned === 1 ? 0 : 1;
  await loadSessions();
  const target = sessions.value.find((s) => s.id === id);
  if (target) {
    // 重新选中以保持高亮
    activeSessionId.value = id;
    messages.value = await getSessionMessages(id);
  }
}

// 重命名
const renamingId = ref<string>('');
const renameTitle = ref('');
function startRename(id: string, title: string) {
  renamingId.value = id;
  renameTitle.value = title;
}
async function commitRename(id: string) {
  if (!renameTitle.value.trim()) return;
  await updateSessionTitle(id, renameTitle.value.trim());
  const session = sessions.value.find((s) => s.id === id);
  if (session) session.title = renameTitle.value.trim();
  renamingId.value = '';
}

// ===== 角色 =====
async function loadRoles() {
  roles.value = await getRoleList();
}

async function selectRole(role: AiApi.ChatRole) {
  activeRole.value = role;
  // 使用角色的推荐模型（如果有）
  if (role.modelPreference && !activeRole.value) {
    const m = models.value.find((x) => x.modelName === role.modelPreference);
    if (m) activeModelId.value = m.id;
  }
  roleDrawerOpen.value = false;
}

async function handleNewChatWithRole(roleId?: string) {
  roleDrawerOpen.value = false;
  await createNewSession(roleId);
}

async function toggleFavorite(role: AiApi.ChatRole) {
  await toggleRoleFavorite(role.id);
  role.isFavorite = !role.isFavorite;
  message.success(
    role.isFavorite ? $t('common.success') : $t('common.success'),
  );
}

// ===== 模型 =====
async function loadModels() {
  try {
    models.value = await getModelList();
    // 默认选中默认模型
    const def = models.value.find((m) => m.isDefault === 1);
    if (def) activeModelId.value = def.id;
  } catch {
    // 模型未配置时不展示，不影响对话页
  }
}

// ===== 发送（会话自带上下文 memory，纯 SSE）=====
async function handleSend() {
  const text = inputText.value.trim();
  if (!text || isStreaming.value) return;

  let sessionId = activeSessionId.value;
  if (!sessionId) {
    // 没有会话时创建（带当前角色）
    sessionId = activeRole.value?.id
      ? await createSession({
          roleId: activeRole.value.id,
          modelId: activeModelId.value || undefined,
        })
      : await createSession({ modelId: activeModelId.value || undefined });
    await loadSessions();
  }

  // 追加用户消息（本地乐观呈现）
  messages.value.push({
    content: text,
    createTime: new Date().toISOString(),
    id: Date.now().toString(),
    role: 'user',
  });

  // reactive 包装 assistant 消息流式追加
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
        assistantMsg.id = Date.now().toString();
        // 首条消息后后端会生成标题，刷新会话列表以同步
        await loadSessions();
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
    if (!(error instanceof Error && error.name === 'AbortError')) {
      assistantMsg.content =
        assistantMsg.content || $t('page.ai.chat.requestError');
    }
    isStreaming.value = false;
    abortController = null;
    assistantMsg.id = Date.now().toString();
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
    message.success($t('common.success'));
  } catch {
    // 忽略剪贴板失败
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
  // 移除尾部助手 + 最后一条用户消息
  while (messages.value.length > 0) {
    const lastMsg = messages.value[messages.value.length - 1];
    messages.value.pop();
    if (lastMsg && lastMsg.role === 'user') break;
  }
  await scrollToBottom(true);
  await handleSend();
}

// ===== Markdown =====
function renderMd(content: string): string {
  if (!content) return '';
  try {
    const raw = marked.parse(content) as string;
    const html = typeof raw === 'string' ? raw : String(raw);
    return DOMPurify.sanitize(html, { ADD_ATTR: ['class'] });
  } catch {
    return content
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }
}

function isErrorText(content: string): boolean {
  return content.startsWith('对话出错：');
}

function handleMarkdownClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.ai-copy-btn');
  if (!target) return;
  const code = target.previousElementSibling?.textContent ?? '';
  navigator.clipboard.writeText(code).catch(() => {});
}

const activeTitle = computed(() => {
  const session = sessions.value.find((s) => s.id === activeSessionId.value);
  return session?.title ?? '';
});

const welcomeShown = computed(() => messages.value.length === 0);

/**
 * 角色分类的中性视觉标记：返回短字符 + 渐变底色类（企业级头像，不用 emoji）。
 * 首字母用分类关键词的文案，保证可读、稳重、不花哨。
 */
function pickRoleMark(category: string | undefined): {
  char: string;
  color: string;
} {
  switch (category) {
    case 'analyst': {
      return { char: '析', color: 'ym-badge--analyst' };
    }
    case 'coder': {
      return { char: '码', color: 'ym-badge--coder' };
    }
    case 'custom': {
      return { char: '自', color: 'ym-badge--custom' };
    }
    case 'translator': {
      return { char: '译', color: 'ym-badge--translator' };
    }
    case 'writer': {
      return { char: '写', color: 'ym-badge--writer' };
    }
    default: {
      return { char: 'AI', color: 'ym-badge--assistant' };
    }
  }
}

function handleSidebarToggle() {
  sidebarOpen.value = !sidebarOpen.value;
}

// ===== 生命周期 =====
onMounted(async () => {
  await Promise.all([loadSessions(), loadRoles(), loadModels()]);
  try {
    knowledgeBases.value = await getKnowledgeBaseList();
  } catch {
    // 知识库不可用时仅隐藏关联选择
  }
  // 默认选中第一个会话
  if (sessions.value.length > 0) {
    await selectSession(sessions.value[0]?.id ?? '');
  }
});

// 键盘快捷键：Ctrl/Cmd + N 新建对话
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    createNewSession();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown);
});
onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
});

async function scrollToBottom(force = false) {
  await nextTick();
  const el = msgListRef.value || welcomeRef.value;
  if (!el) return;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  if (force || nearBottom) {
    el.scrollTop = el.scrollHeight;
  }
}
</script>

<template>
  <div class="ym-ai">
    <!-- 左侧栏 -->
    <aside class="ym-ai__sidebar" :class="{ collapsed: !sidebarOpen }">
      <div class="ym-ai__sidebar-header">
        <div class="ym-ai__logo">
          <span class="ym-ai__logo-mark">AI</span>
          <span v-if="sidebarOpen" class="ym-ai__logo-text">Ypbin AI</span>
        </div>
        <Button
          v-access:code="['ai:chat:create']"
          class="ym-ai__new-btn"
          type="primary"
          block
          @click="createNewSession()"
        >
          <template v-if="sidebarOpen">
            <Plus class="size-4" />
            {{ $t('page.ai.chat.newChat') }}
          </template>
          <Plus v-else class="size-4 mx-auto" />
        </Button>
      </div>

      <!-- 会话列表 -->
      <div v-if="sidebarOpen" class="ym-ai__session-list">
        <div class="ym-ai__section-label">{{ $t('page.ai.chat.history') }}</div>
        <div
          v-for="session in sessions"
          :key="session.id"
          class="ym-ai__session-item"
          :class="{ active: session.id === activeSessionId }"
          @click="selectSession(session.id)"
        >
          <template v-if="renamingId === session.id">
            <Input
              v-model:value="renameTitle"
              size="small"
              autofocus
              @blur="commitRename(session.id)"
              @press-enter="commitRename(session.id)"
            />
          </template>
          <template v-else>
            <span class="ym-ai__session-title">{{ session.title }}</span>
            <div class="ym-ai__session-actions">
              <Tooltip :title="$t('page.ai.chat.pinSession')">
                <Button
                  :class="{ pinned: session.isPinned === 1 }"
                  size="small"
                  type="text"
                  @click.stop="handlePinSession(session.id)"
                >
                  <svg
                    class="size-3.5"
                    :fill="session.isPinned === 1 ? 'currentColor' : 'none'"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                    stroke-linecap="round"
                    stroke-linejoin="round"
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
                    class="size-3.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                    stroke-linecap="round"
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
                <Button size="small" danger type="text">
                  <svg
                    class="size-3.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                    stroke-linecap="round"
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
        <div v-if="sessions.length === 0" class="ym-ai__empty-session">
          {{ $t('page.ai.chat.emptyHint') }}
        </div>
      </div>

      <!-- 底部：角色选择 + 模型 -->
      <div v-if="sidebarOpen" class="ym-ai__sidebar-footer">
        <div class="ym-ai__role-indicator" @click="roleDrawerOpen = true">
          <span
            class="ym-badge"
            :class="pickRoleMark(activeRole?.category).color"
            >{{ pickRoleMark(activeRole?.category).char }}</span>
          <span class="ym-ai__role-name">{{
            activeRole ? activeRole.name : $t('page.ai.chat.selectRole')
          }}</span>
        </div>
        <Select
          v-model:value="activeModelId"
          :placeholder="$t('page.ai.chat.modelSelect')"
          size="small"
          class="ym-ai__model-select"
          allow-clear
        >
          <Select.Option v-for="m in models" :key="m.id" :value="m.id">
            {{ m.name }}
          </Select.Option>
        </Select>
      </div>
    </aside>

    <!-- 主区域 -->
    <main class="ym-ai__main">
      <!-- 顶部栏 -->
      <header class="ym-ai__topbar">
        <Button
          class="ym-ai__menu-toggle"
          type="text"
          @click="handleSidebarToggle"
        >
          <Menu class="size-4" />
        </Button>
        <span v-if="activeTitle" class="ym-ai__topbar-title">{{
          activeTitle
        }}</span>
      </header>

      <!-- 欢迎页 -->
      <div v-if="welcomeShown" ref="welcomeRef" class="ym-ai__welcome">
        <div class="ym-ai__welcome-inner">
          <h1 class="ym-ai__welcome-title">
            {{ $t('page.ai.chat.welcomeTitle') }}
          </h1>
          <p class="ym-ai__welcome-subtitle">
            {{ $t('page.ai.chat.welcomeSubtitle') }}
          </p>

          <!-- 角色卡片 -->
          <div class="ym-ai__welcome-roles">
            <div
              v-for="role in featuredRoles"
              :key="role.id"
              class="ym-ai__role-card"
              @click="handleNewChatWithRole(role.id)"
            >
              <span
                class="ym-badge"
                :class="pickRoleMark(role.category).color"
                >{{ pickRoleMark(role.category).char }}</span>
              <span class="ym-ai__role-card-name">{{ role.name }}</span>
              <span class="ym-ai__role-card-desc">{{ role.description }}</span>
            </div>
          </div>

          <!-- 快捷问题 -->
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

      <!-- 消息列表 -->
      <div v-else ref="msgListRef" class="ym-ai__messages">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="ym-ai__msg"
          :class="`ym-ai__msg--${msg.role}`"
        >
          <!-- AI 消息 -->
          <div v-if="msg.role === 'assistant'" class="ym-ai__msg-ai">
            <div
              class="ym-ai__avatar ym-ai__avatar--ai"
              :class="pickRoleMark(activeRole?.category).color"
            >
              {{ pickRoleMark(activeRole?.category).char }}
            </div>
            <div class="ym-ai__msg-content">
              <div class="ym-ai__msg-name">Ypbin AI</div>
              <!-- eslint-disable vue/no-v-html -->
              <div
                v-if="msg.content"
                class="ym-ai__markdown"
                :class="{ 'ym-ai__markdown--error': isErrorText(msg.content) }"
                v-html="renderMd(msg.content)"
                @click="handleMarkdownClick"
              ></div>
              <!-- eslint-enable vue/no-v-html -->
              <span v-else class="ym-ai__thinking">{{
                $t('page.ai.chat.thinking')
              }}</span>

              <div
                v-if="!isStreaming || msg.id !== 'streaming'"
                class="ym-ai__msg-actions"
              >
                <button
                  class="ym-ai__action"
                  :title="$t('page.ai.chat.copy')"
                  @click="copyMessage(msg.content)"
                >
                  <svg
                    class="size-4"
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
                  >
                    <path d="M7 10v12" />
                    <path
                      d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
                    />
                  </svg>
                </button>
                <button
                  class="ym-ai__action"
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
                  >
                    <path d="M17 14V2" />
                    <path
                      d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
                    />
                  </svg>
                </button>
                <button
                  class="ym-ai__action"
                  :title="$t('page.ai.chat.regenerate')"
                  @click="regenerate"
                >
                  <RotateCw class="size-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- 用户消息 -->
          <div v-else class="ym-ai__msg-user">
            <div class="ym-ai__user-bubble">
              <span class="ym-ai__plain">{{ msg.content }}</span>
            </div>
            <div class="ym-ai__avatar ym-ai__avatar--user">我</div>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="ym-ai__input-area">
        <div class="ym-ai__input-box">
          <Input.TextArea
            v-model:value="inputText"
            :auto-size="{ maxRows: 10, minRows: 1 }"
            :disabled="isStreaming"
            :placeholder="$t('page.ai.chat.placeholder')"
            class="ym-ai__textarea"
            @keydown="handleKeydown"
          />
          <div class="ym-ai__input-tools">
            <Select
              v-if="knowledgeBases.length > 0"
              v-model:value="activeKbId"
              :placeholder="$t('page.ai.chat.attachKb')"
              class="ym-ai__kb-select"
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

            <div v-if="activeRole" class="ym-ai__active-role-chip">
              <span>{{ pickRoleMark(activeRole.category).char }}</span>
              {{ activeRole.name }}
              <button @click="activeRole = null">×</button>
            </div>

            <div class="ym-ai__input-tools-right">
              <button
                v-if="!isStreaming"
                class="ym-ai__send"
                :disabled="!inputText.trim()"
                @click="handleSend"
              >
                <svg
                  class="size-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                  stroke-linecap="round"
                >
                  <path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" />
                </svg>
              </button>
              <button
                v-else
                class="ym-ai__send ym-ai__send--stop"
                @click="handleStop"
              >
                <Square class="size-4" />
              </button>
            </div>
          </div>
        </div>
        <p class="ym-ai__input-tip">{{ $t('page.ai.chat.enterTip') }}</p>
      </div>
    </main>

    <!-- 角色选择抽屉 -->
    <Transition name="ym-role">
      <div v-if="roleDrawerOpen" class="ym-role-drawer">
        <div class="ym-role-mask" @click="roleDrawerOpen = false"></div>
        <div class="ym-role-panel">
          <div class="ym-role-header">
            <h3>{{ $t('page.ai.chat.selectRole') }}</h3>
            <button class="ym-role-close" @click="roleDrawerOpen = false">
              <X class="size-4" />
            </button>
          </div>
          <div class="ym-role-search">
            <Search class="size-4" />
            <Input
              v-model:value="roleSearch"
              :placeholder="$t('page.ai.chat.rolePlaceholder')"
              size="small"
            />
          </div>
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
                  : $t(`page.ai.chat.roleCategory_${cat}`)
              }}
            </button>
          </div>
          <div class="ym-role-list">
            <div
              v-for="role in filteredRoles"
              :key="role.id"
              class="ym-role-item"
              @click="selectRole(role)"
            >
              <span
                class="ym-badge"
                :class="pickRoleMark(role.category).color"
                >{{ pickRoleMark(role.category).char }}</span>
              <div class="ym-role-info">
                <span class="ym-role-name">{{ role.name }}</span>
                <span class="ym-role-desc">{{ role.description }}</span>
              </div>
              <button
                class="ym-role-fav"
                :class="{ active: role.isFavorite }"
                @click.stop="toggleFavorite(role)"
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
              {{ $t('page.ai.chat.roleAll') }} 暂无角色
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ===== AI 对话页样式 ===== */
.ym-ai {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: hsl(var(--background));
}

/* ===== 侧边栏 ===== */
.ym-ai__sidebar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 260px;
  background: hsl(var(--secondary) / 30%);
  border-right: 1px solid hsl(var(--border));
  transition: width 0.2s;
}

.ym-ai__sidebar.collapsed {
  width: 60px;
}

.ym-ai__sidebar.collapsed .ym-ai__new-btn {
  width: 40px;
  height: 40px;
  margin: 8px auto;
}

.ym-ai__sidebar-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.ym-ai__logo {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 6px;
}

.ym-ai__logo-mark {
  font-size: 18px;
  color: hsl(var(--primary));
  animation: ym-spin 12s linear infinite;
}

.ym-ai__logo-text {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

@keyframes ym-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.ym-ai__new-btn {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  font-weight: 500;
}

.ym-ai__session-list {
  flex: 1;
  min-height: 0;
  padding: 8px;
  overflow-y: auto;
}

.ym-ai__section-label {
  padding: 8px 10px 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ym-ai__session-item {
  display: flex;
  align-items: center;
  padding: 7px 10px;
  margin-bottom: 2px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
}

.ym-ai__session-item:hover {
  background: hsl(var(--muted));
}

.ym-ai__session-item.active {
  background: hsl(var(--muted) / 70%);
}

.ym-ai__session-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  white-space: nowrap;
}

.ym-ai__session-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.ym-ai__session-item:hover .ym-ai__session-actions {
  opacity: 1;
}

.ym-ai__session-actions .pinned {
  color: hsl(var(--primary));
}

.ym-ai__empty-session {
  padding: 20px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.ym-ai__sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid hsl(var(--border));
}

.ym-ai__role-indicator {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
}

.ym-ai__role-indicator:hover {
  background: hsl(var(--muted));
}

.ym-ai__role-emoji {
  font-size: 16px;
}

.ym-ai__role-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.ym-ai__model-select {
  width: 100%;
}

/* ===== 主区域 ===== */
.ym-ai__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.ym-ai__topbar {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  height: 52px;
  padding: 0 12px;
  border-bottom: 1px solid hsl(var(--border));
}

.ym-ai__menu-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  color: hsl(var(--foreground));
}

.ym-ai__menu-toggle:hover {
  background: hsl(var(--muted));
}

.ym-ai__topbar-title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

/* ===== 欢迎页 ===== */
.ym-ai__welcome {
  flex: 1;
  padding: 48px 24px;
  overflow-y: auto;
}

.ym-ai__welcome-inner {
  max-width: 640px;
  margin: 0 auto;
  text-align: center;
}

.ym-ai__welcome-title {
  margin: 0 0 8px;
  font-size: 34px;
  font-weight: 700;
  color: transparent;
  letter-spacing: -1px;
  background: linear-gradient(135deg, hsl(var(--primary)), hsl(262deg 83% 58%));
  background-clip: text;
}

.ym-ai__welcome-subtitle {
  margin: 0 0 32px;
  font-size: 15px;
  color: hsl(var(--muted-foreground));
}

.ym-ai__welcome-roles {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 28px;
}

.ym-ai__role-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  transition: all 0.2s;
}

.ym-ai__role-card:hover {
  border-color: hsl(var(--primary));
  box-shadow: 0 4px 20px hsl(var(--primary) / 10%);
  transform: translateY(-2px);
}

.ym-ai__role-card-emoji {
  margin-bottom: 4px;
  font-size: 24px;
}

.ym-ai__role-card-name {
  font-size: 15px;
  font-weight: 600;
}

.ym-ai__role-card-desc {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  -webkit-box-orient: vertical;
}

.ym-ai__quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.ym-ai__quick-q {
  padding: 8px 14px;
  font-size: 13px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 20px;
  transition: all 0.15s;
}

.ym-ai__quick-q:hover {
  background: hsl(var(--muted) / 60%);
  border-color: hsl(var(--primary) / 40%);
}

/* ===== 消息列表 ===== */
.ym-ai__messages {
  flex: 1;
  width: 100%;
  max-width: 820px;
  padding: 20px 16px;
  margin: 0 auto;
  overflow-y: auto;
}

.ym-ai__msg {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.ym-ai__msg--ai {
  flex-direction: row;
  align-items: flex-start;
}

.ym-ai__msg-user {
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-start;
  justify-content: flex-start;
  width: 100%;
}

.ym-ai__avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 16px;
  border-radius: 8px;
}

.ym-ai__avatar--ai {
  color: #fff;
  background: linear-gradient(135deg, hsl(221deg 83% 53%), hsl(262deg 83% 58%));
}

.ym-ai__avatar--user {
  background: hsl(var(--secondary));
}

/* ===== 角色中性标记（圆形头像徽章，不用 emoji） ===== */
.ym-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  color: #fff;
  border-radius: 50%;
}

.ym-badge--assistant,
.ym-ai__avatar.ym-badge--assistant {
  background: linear-gradient(135deg, hsl(221deg 83% 53%), hsl(262deg 83% 58%));
}

.ym-badge--translator,
.ym-ai__avatar.ym-badge--translator {
  background: linear-gradient(
    135deg,
    hsl(199deg 89% 48%),
    hsl(187deg 100% 42%)
  );
}

.ym-badge--coder,
.ym-ai__avatar.ym-badge--coder {
  background: linear-gradient(135deg, hsl(262deg 83% 58%), hsl(330deg 81% 60%));
}

.ym-badge--analyst,
.ym-ai__avatar.ym-badge--analyst {
  background: linear-gradient(135deg, hsl(215deg 91% 48%), hsl(221deg 83% 53%));
}

.ym-badge--writer,
.ym-ai__avatar.ym-badge--writer {
  background: linear-gradient(135deg, hsl(32deg 95% 44%), hsl(28deg 95% 50%));
}

.ym-badge--custom,
.ym-ai__avatar.ym-badge--custom {
  background: linear-gradient(135deg, hsl(220deg 8% 40%), hsl(220deg 8% 55%));
}

.ym-ai__msg-content {
  min-width: 0;
  max-width: calc(100% - 48px);
  padding-top: 2px;
}

.ym-ai__msg-name {
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

.ym-ai__user-bubble {
  flex-shrink: 0;
  min-width: 0;
  max-width: 76%;
  padding: 10px 14px;
  font-size: 15px;
  line-height: 1.7;
  color: hsl(var(--foreground));
  overflow-wrap: break-word;
  white-space: pre-wrap;
  background: hsl(var(--primary) / 10%);
  border-radius: 12px;
  border-bottom-right-radius: 3px;
}

.ym-ai__plain {
  font-size: 15px;
  line-height: 1.7;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}

.ym-ai__markdown {
  font-size: 15px;
  line-height: 1.75;
  color: hsl(var(--foreground));
  overflow-wrap: break-word;
}

.ym-ai__markdown--error {
  color: hsl(var(--destructive, 0 72% 51%));
}

.ym-ai__thinking {
  color: hsl(var(--muted-foreground));
  animation: ym-blink 1s infinite;
}

@keyframes ym-blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}

.ym-ai__msg-actions {
  display: flex;
  gap: 2px;
  margin-top: 6px;
  opacity: 0;
  transition: opacity 0.2s;
}

.ym-ai__msg:hover .ym-ai__msg-actions {
  opacity: 1;
}

.ym-ai__action {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 5px;
  transition: all 0.15s;
}

.ym-ai__action:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--muted));
}

.ym-ai__action.active {
  color: hsl(var(--primary));
}

/* ===== 输入区 ===== */
.ym-ai__input-area {
  flex-shrink: 0;
  padding: 8px 16px 16px;
}

.ym-ai__input-box {
  width: min(56vw, 820px);
  min-width: 360px;
  padding: 14px 14px 10px 18px;
  margin: 0 auto;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 14px;
  box-shadow: 0 2px 12px hsl(var(--foreground) / 6%);
  transition: all 0.2s;
}

.ym-ai__input-box:focus-within {
  border-color: hsl(var(--primary) / 60%);
  box-shadow: 0 4px 20px hsl(var(--primary) / 14%);
}

.ym-ai__textarea {
  min-height: 52px;
  font-size: 15px;
  resize: none;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.ym-ai__input-tools {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
}

.ym-ai__kb-select {
  width: 180px;
}

.ym-ai__active-role-chip {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 3px 8px;
  font-size: 12px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
  border-radius: 12px;
}

.ym-ai__active-role-chip button {
  padding: 0 2px;
  font-size: 13px;
  line-height: 1;
  color: inherit;
  cursor: pointer;
  background: none;
  border: none;
}

.ym-ai__input-tools-right {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.ym-ai__send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  background: hsl(var(--primary));
  border: none;
  border-radius: 50%;
  transition: opacity 0.15s;
}

.ym-ai__send:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.ym-ai__send--stop {
  background: hsl(var(--destructive, 0 72% 51%));
}

.ym-ai__input-tip {
  max-width: 820px;
  margin: 8px auto 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

/* ===== Markdown 样式 ===== */
.ym-ai__markdown :deep(p) {
  margin: 0 0 10px;
}

.ym-ai__markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.ym-ai__markdown :deep(h1),
.ym-ai__markdown :deep(h2),
.ym-ai__markdown :deep(h3) {
  margin: 14px 0 8px;
  font-weight: 600;
}

.ym-ai__markdown :deep(ul),
.ym-ai__markdown :deep(ol) {
  padding-left: 22px;
  margin: 8px 0;
}

.ym-ai__markdown :deep(li) {
  margin: 3px 0;
}

.ym-ai__markdown :deep(blockquote) {
  padding-left: 12px;
  margin: 10px 0;
  color: hsl(var(--muted-foreground));
  border-left: 3px solid hsl(var(--border));
}

.ym-ai__markdown :deep(a) {
  color: hsl(var(--primary));
}

.ym-ai__markdown :deep(.ai-code-block) {
  position: relative;
  margin: 10px 0;
  overflow-x: auto;
  background: hsl(var(--secondary));
  border-radius: 8px;
}

.ym-ai__markdown :deep(.ai-code-block code) {
  display: block;
  padding: 14px;
  font-size: 13px;
  line-height: 1.6;
}

.ym-ai__markdown :deep(.ai-copy-btn) {
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

.ym-ai__markdown :deep(.ai-copy-btn svg) {
  width: 12px;
  height: 12px;
}

.ym-ai__markdown :deep(.ai-code-block:hover .ai-copy-btn) {
  opacity: 1;
}

.ym-ai__markdown :deep(code:not(.hljs)) {
  padding: 2px 5px;
  font-size: 13px;
  background: hsl(var(--secondary));
  border-radius: 3px;
}

.ym-ai__markdown :deep(table) {
  width: 100%;
  margin: 10px 0;
  font-size: 13px;
  border-collapse: collapse;
}

.ym-ai__markdown :deep(th),
.ym-ai__markdown :deep(td) {
  padding: 6px 10px;
  text-align: left;
  border: 1px solid hsl(var(--border));
}

.ym-ai__markdown :deep(th) {
  background: hsl(var(--secondary));
}

/* ===== 角色抽屉 ===== */
.ym-role-mask {
  position: absolute;
  inset: 0;
  z-index: 50;
  background: hsl(var(--foreground) / 30%);
  backdrop-filter: blur(2px);
}

.ym-role-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 51;
  display: flex;
  flex-direction: column;
  width: 320px;
  background: hsl(var(--background));
  border-left: 1px solid hsl(var(--border));
  box-shadow: -4px 0 24px hsl(var(--foreground) / 10%);
}

.ym-role-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.ym-role-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.ym-role-close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
}

.ym-role-close:hover {
  background: hsl(var(--muted));
}

.ym-role-search {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 16px;
  color: hsl(var(--muted-foreground));
  border-bottom: 1px solid hsl(var(--border));
}

.ym-role-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.ym-role-cat {
  padding: 4px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  transition: all 0.15s;
}

.ym-role-cat:hover {
  border-color: hsl(var(--primary) / 40%);
}

.ym-role-cat.active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 12%);
  border-color: hsl(var(--primary) / 40%);
}

.ym-role-list {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.ym-role-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
}

.ym-role-item:hover {
  background: hsl(var(--muted));
}

.ym-role-emoji {
  font-size: 22px;
}

.ym-role-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.ym-role-name {
  font-size: 14px;
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
  align-items: center;
  justify-content: center;
  padding: 5px;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 5px;
  transition: color 0.15s;
}

.ym-role-fav.active {
  color: hsl(48deg 96% 53%);
}

.ym-role-fav:hover {
  background: hsl(var(--muted));
}

.ym-role-empty {
  padding: 32px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.ym-role-enter-active,
.ym-role-leave-active {
  transition: opacity 0.2s;
}

.ym-role-enter-active .ym-role-panel,
.ym-role-leave-active .ym-role-panel {
  transition: transform 0.2s;
}

.ym-role-enter-from,
.ym-role-leave-to {
  opacity: 0;
}

.ym-role-enter-from .ym-role-panel,
.ym-role-leave-to .ym-role-panel {
  transform: translateX(100%);
}
</style>
