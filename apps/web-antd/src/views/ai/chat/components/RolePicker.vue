<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed } from 'vue';

import { X } from '@vben/icons';

import { Button, Input } from 'ant-design-vue';

import { $t } from '#/locales';
import { roleBadge } from '#/views/ai/_shared/role-badge';

defineOptions({ name: 'ChatRolePicker' });

const props = withDefaults(
  defineProps<{
    activeRoleId: string;
    open: boolean;
    roles: AiApi.ChatRole[];
    search: string;
    category: string;
  }>(),
  {
    activeRoleId: '',
    open: false,
    roles: () => [],
    search: '',
    category: 'all',
  },
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'favorite', role: AiApi.ChatRole, event: Event): void;
  (e: 'search', value: string): void;
  (e: 'select', role: AiApi.ChatRole): void;
  (e: 'category', value: string): void;
}>();

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
  const kw = props.search.trim().toLowerCase();
  return props.roles.filter((role) => {
    const cat = props.category;
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

function categoryLabel(cat: string): string {
  if (cat === 'all') return $t('page.ai.chat.roleAll');
  if (cat === 'favorite') return $t('page.ai.chat.roleFavorite');
  if (cat === 'custom') return $t('page.ai.chat.roleCustom');
  return $t(`page.ai.chat.roleCategory_${cat}`);
}
</script>

<template>
  <Transition name="ym-role">
    <div v-if="open" class="ym-role-overlay" @click.self="emit('close')">
      <div class="ym-role-panel">
        <div class="ym-role-header">
          <span class="ym-role-title">{{
            $t('page.ai.chat.selectRole')
          }}</span>
          <Button size="small" type="text" @click="emit('close')">
            <X class="size-4" />
          </Button>
        </div>

        <!-- 分类 Tab -->
        <div class="ym-role-cats">
          <button
            v-for="cat in roleCategories"
            :key="cat"
            class="ym-role-cat"
            :class="{ active: category === cat }"
            @click="emit('category', cat)"
          >
            {{ categoryLabel(cat) }}
          </button>
        </div>

        <!-- 搜索 -->
        <div class="ym-role-search">
          <Input
            :model-value="search"
            :placeholder="$t('page.ai.chat.rolePlaceholder')"
            allow-clear
            size="small"
            @update:model-value="emit('search', $event)"
          />
        </div>

        <!-- 角色列表 -->
        <div class="ym-role-list">
          <div
            v-for="role in filteredRoles"
            :key="role.id"
            class="ym-role-item"
            :class="{ active: activeRoleId === role.id }"
            @click="emit('select', role)"
          >
            <span class="ym-badge" :class="roleBadge(role.category).cls">
              {{ roleBadge(role.category).char }}
            </span>
            <div class="ym-role-info">
              <span class="ym-role-name">{{ role.name }}</span>
              <span class="ym-role-desc">{{ role.description }}</span>
            </div>
            <button
              class="ym-role-fav"
              :class="{ active: role.isFavorite }"
              :title="
                role.isFavorite
                  ? $t('page.ai.chat.unfavoriteRole')
                  : $t('page.ai.chat.favoriteRole')
              "
              @click.stop="emit('favorite', role, $event)"
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
              category === 'favorite'
                ? $t('page.ai.chat.noFavoriteRoles')
                : $t('page.ai.chat.noMatchingRoles')
            }}
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
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
