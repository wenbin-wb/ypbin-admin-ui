<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, ref } from 'vue';

import { IconifyIcon, Menu, Plus, Search } from '@vben/icons';

import { Button, Input, Popconfirm, Tooltip } from 'ant-design-vue';

import { $t } from '#/locales';

defineOptions({ name: 'ChatSessionSidebar' });

const props = withDefaults(
  defineProps<{
    activeSessionId: string;
    collapsed: boolean;
    loading: boolean;
    search: string;
    sessions: AiApi.ChatSession[];
  }>(),
  {
    activeSessionId: '',
    collapsed: false,
    loading: false,
    sessions: () => [],
    search: '',
  },
);

const emit = defineEmits<{
  (e: 'collapse', value: boolean): void;
  (e: 'create'): void;
  (e: 'delete', id: string): void;
  (e: 'pin', id: string): void;
  (e: 'rename', id: string, title: string): void;
  (e: 'search', value: string): void;
  (e: 'select', id: string): void;
}>();

// 重命名
const renamingId = ref('');
const renameTitle = ref('');
function startRename(id: string, title: string) {
  renamingId.value = id;
  renameTitle.value = title;
}
function commitRename(id: string) {
  const t = renameTitle.value.trim();
  if (!t) {
    renamingId.value = '';
    return;
  }
  emit('rename', id, t);
  renamingId.value = '';
}

type SessionGroup = { items: AiApi.ChatSession[]; key: string; label: string };

const filteredSessions = computed(() => {
  const kw = props.search.trim().toLowerCase();
  if (!kw) return props.sessions;
  return props.sessions.filter((s) => s.title.toLowerCase().includes(kw));
});

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
</script>

<template>
  <aside
    class="ym-ai__sidebar"
    :class="{ 'ym-ai__sidebar--collapsed': collapsed }"
  >
    <!-- 头部：Logo + 展开/收起 -->
    <div class="ym-ai__sidebar-top">
      <div class="ym-ai__logo">
        <IconifyIcon icon="lucide:sparkles" class="ym-ai__logo-icon size-5" />
        <span v-show="collapsed === false" class="ym-ai__logo-text">Ypbin AI</span>
      </div>
      <Button
        size="small"
        type="text"
        class="ym-ai__collapse-btn"
        :title="
          collapsed
            ? $t('page.ai.chat.expandSidebar')
            : $t('page.ai.chat.collapseSidebar')
        "
        @click="emit('collapse', !collapsed)"
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
        @click="emit('create')"
      >
        <Plus class="size-4" />
        <span v-show="collapsed === false">{{
          $t('page.ai.chat.newChat')
        }}</span>
      </Button>
    </div>

    <!-- 搜索框（仅展开态） -->
    <div v-show="collapsed === false" class="ym-ai__sidebar-search">
      <Input
        :model-value="search"
        :placeholder="$t('page.ai.chat.searchSessions')"
        allow-clear
        size="small"
        @update:model-value="emit('search', $event)"
      >
        <template #prefix>
          <Search class="size-3.5 text-muted-foreground" />
        </template>
      </Input>
    </div>

    <!-- 会话列表（分组） -->
    <div class="ym-ai__session-list">
      <!-- 无会话 -->
      <div v-if="loading" class="ym-ai__session-loading">
        <div v-for="i in 4" :key="i" class="ym-ai__session-skeleton"></div>
      </div>
      <div
        v-else-if="filteredSessions.length === 0"
        class="ym-ai__session-empty"
      >
        <span v-if="search">{{ $t('page.ai.chat.searchEmpty') }}</span>
        <span v-else>{{ $t('page.ai.chat.noSessions') }}</span>
      </div>
      <template v-else>
        <div
          v-for="group in sessionGroups"
          :key="group.key"
          class="ym-ai__group"
        >
          <div v-show="collapsed === false" class="ym-ai__group-label">
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
            @click="emit('select', session.id)"
          >
            <!-- 置顶圆点（仅折叠时显示） -->
            <span
              v-if="collapsed && session.isPinned === 1"
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
                  v-if="session.isPinned === 1 && !collapsed"
                  class="ym-ai__pin-icon"
                  :title="$t('page.ai.chat.pinned')"
                >
                  <svg class="size-2.5" fill="currentColor" viewBox="0 0 24 24">
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
                <span
                  v-show="collapsed === false"
                  class="ym-ai__session-title"
                  >{{ session.title }}</span>
              </div>

              <!-- 操作按钮（hover 时显示） -->
              <div v-show="collapsed === false" class="ym-ai__session-actions">
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
                    @click.stop="emit('pin', session.id)"
                  >
                    <svg
                      class="size-3"
                      :fill="session.isPinned === 1 ? 'currentColor' : 'none'"
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
                  @confirm="emit('delete', session.id)"
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
</template>

<style scoped>
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
  max-width: 0;
  overflow: hidden;
  opacity: 0;
  transition:
    max-width 0.18s ease,
    opacity 0.15s;
}

.ym-ai__session-item:hover .ym-ai__session-actions {
  max-width: 100px;
  opacity: 1;
}
</style>
