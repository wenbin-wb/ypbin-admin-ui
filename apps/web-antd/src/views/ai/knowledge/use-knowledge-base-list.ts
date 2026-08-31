import type { AiApi } from '#/api/ai';

import { computed, ref } from 'vue';

import { getKnowledgeBaseList } from '#/api/ai';

/** 知识库 ID 取色色盘（按 id 稳定取色） */
const COLOR_PALETTE = [
  'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
];

/**
 * 知识库列表域：加载、关键词过滤与卡片展示辅助（图标/取色）。
 */
export function useKnowledgeBaseList() {
  const knowledgeBases = ref<AiApi.KnowledgeBase[]>([]);
  const loading = ref(false);
  const keyword = ref('');

  const filteredKbs = computed(() => {
    const kw = keyword.value.trim().toLowerCase();
    if (!kw) return knowledgeBases.value;
    return knowledgeBases.value.filter(
      (kb) =>
        kb.name.toLowerCase().includes(kw) ||
        (kb.description ?? '').toLowerCase().includes(kw),
    );
  });

  async function loadKbs() {
    loading.value = true;
    try {
      knowledgeBases.value = await getKnowledgeBaseList();
    } finally {
      loading.value = false;
    }
  }

  /** 取知识库默认展示内容：优先 icon 字段，否则取名称首字 */
  function kbIcon(kb: AiApi.KnowledgeBase) {
    if (kb.icon && kb.icon.trim()) return kb.icon.trim();
    return kb.name.charAt(0).toUpperCase();
  }

  /** 判断 icon 字段是否为 Iconify 图标名（如 lucide:book-open），是则用图标渲染 */
  function isIconifyIcon(icon?: string): boolean {
    return Boolean(icon && icon.includes(':'));
  }

  /** 根据知识库 ID 生成一个稳定的背景色（从预设色盘中取） */
  function kbColor(kb: AiApi.KnowledgeBase) {
    // 用 id 末两位数值取色
    const n = Number.parseInt(kb.id.slice(-2), 16) || 0;
    return COLOR_PALETTE[n % COLOR_PALETTE.length];
  }

  return {
    filteredKbs,
    isIconifyIcon,
    kbColor,
    kbIcon,
    keyword,
    knowledgeBases,
    loadKbs,
    loading,
  };
}
