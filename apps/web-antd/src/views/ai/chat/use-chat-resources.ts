import type { Ref } from 'vue';

import type { AiApi } from '#/api/ai';

import { computed, ref } from 'vue';

import {
  getKnowledgeBaseList,
  getModelList,
  getRoleList,
  toggleRoleFavorite,
} from '#/api/ai';

/**
 * 聊天页的资源域：角色、模型、知识库的加载与选择。
 *
 * 选中角色会按其偏好联动模型，模型列表缺失时调用方应隐藏选择器。
 */
export function useChatResources(deps: { activeModelId: Ref<string> }) {
  // 角色
  const roles = ref<AiApi.ChatRole[]>([]);
  const activeRole = ref<AiApi.ChatRole | null>(null);
  const roleDrawerOpen = ref(false);
  const roleSearch = ref('');
  const roleCategory = ref<string>('all');

  // 模型
  const models = ref<AiApi.ModelConfig[]>([]);
  const activeModelId = deps.activeModelId;

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
    // 应用角色偏好模型
    if (role.modelPreference) {
      const m = models.value.find((x) => x.modelName === role.modelPreference);
      if (m) activeModelId.value = m.id;
    }
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

  async function loadModels() {
    try {
      models.value = await getModelList();
      const def = models.value.find((m) => m.isDefault === 1);
      if (def) activeModelId.value = def.id;
    } catch (error) {
      // 模型未配置时不展示选择器
      console.warn('Failed to load models:', error);
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
  };
}
