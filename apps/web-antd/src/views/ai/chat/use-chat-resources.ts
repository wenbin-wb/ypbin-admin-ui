import type { AiApi } from '#/api/ai';

import { computed, ref } from 'vue';

import {
  getKnowledgeBaseList,
  getRoleList,
  toggleRoleFavorite,
} from '#/api/ai';

/**
 * 聊天页的资源域：角色、知识库的加载与选择。
 *
 * 模型不在此处管理：后端/starter 只按租户默认对话模型构建 ChatClient，
 * 按会话选模型会被拒绝，前端因此不提供选择器（避免「选了不生效」）。
 */
export function useChatResources() {
  // 角色
  const roles = ref<AiApi.ChatRole[]>([]);
  const activeRole = ref<AiApi.ChatRole | null>(null);
  const roleDrawerOpen = ref(false);
  const roleSearch = ref('');
  const roleCategory = ref<string>('all');

  // 知识库（RAG）
  const knowledgeBases = ref<AiApi.KnowledgeBase[]>([]);
  const activeKbId = ref('');

  async function loadRoles() {
    try {
      roles.value = await getRoleList();
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  }

  function selectRole(role: AiApi.ChatRole) {
    activeRole.value = role;
    roleDrawerOpen.value = false;
  }

  async function toggleFavorite(role: AiApi.ChatRole, e: Event) {
    e.stopPropagation();
    try {
      await toggleRoleFavorite(role.id);
      role.isFavorite = !role.isFavorite;
    } catch (error) {
      console.error('Failed to toggle role favorite:', error);
    }
  }

  async function loadKnowledgeBases() {
    try {
      knowledgeBases.value = await getKnowledgeBaseList();
    } catch (error) {
      console.warn('Failed to load knowledge bases:', error);
    }
  }

  const featuredRoles = computed(() =>
    roles.value.filter((r) => r.isBuiltin === 1).slice(0, 4),
  );

  return {
    activeKbId,
    activeRole,
    featuredRoles,
    knowledgeBases,
    loadKnowledgeBases,
    loadRoles,
    roleCategory,
    roleDrawerOpen,
    roleSearch,
    roles,
    selectRole,
    toggleFavorite,
  };
}
