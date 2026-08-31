import type { AiApi } from '#/api/ai';

import { computed, ref } from 'vue';

import { message } from 'ant-design-vue';

import {
  queryKnowledgeBase,
  searchKnowledgeBaseMultiple,
  searchKnowledgeBaseRerank,
  searchKnowledgeBaseTest,
} from '#/api/ai';
import { $t } from '#/locales';
import { extractErrorMessage } from '#/utils/error';

/**
 * 知识库检索测试域：提问、多模式召回（单库/重排/多库）与评估汇总、关键词高亮。
 */
export function useRecallTest(deps: {
  getKb: () => AiApi.KnowledgeBase | null | undefined;
}) {
  const testQuery = ref('');
  const testAnswer = ref('');
  const testLoading = ref(false);
  const recallList = ref<AiApi.KbSearchHit[]>([]);
  const testMode = ref<'multiple' | 'rerank' | 'single'>('single');

  // ---- 召回评估汇总 ----
  const recallStats = computed(() => {
    if (recallList.value.length === 0) return null;
    const scores = recallList.value.map((h) => h.score ?? 0);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const max = Math.max(...scores);
    const tokens = new Set<string>();
    recallList.value.forEach((h) =>
      h.hitKeywords?.forEach((t) => tokens.add(t)),
    );
    const hitCount = recallList.value.filter(
      (h) => (h.score ?? 0) >= 50,
    ).length;
    return { avg, max, tokens: [...tokens], hitCount };
  });

  /** 相关度分颜色：>=70 绿 / >=40 黄 / 其余红 */
  function scoreColor(score = 0) {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500/70';
  }

  function scoreTextColor(score = 0) {
    if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 40) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-500';
  }

  /** 将命中的关键词在片段文本中高亮（长词优先，防嵌套替换） */
  function highlightKeywords(text: string, keywords?: string[]) {
    if (!keywords?.length || !text) return text;
    const pattern = [...keywords]
      .toSorted((a, b) => b.length - a.length)
      .map((k) => k.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`))
      .filter((k) => k.length >= 2)
      .join('|');
    if (!pattern) return text;
    const re = new RegExp(`(${pattern})`, 'gi');
    return text.replace(
      re,
      '<mark class="rounded-sm bg-amber-200/80 px-0.5 text-inherit dark:bg-amber-500/30">$1</mark>',
    );
  }

  async function onTestQuery() {
    if (!testQuery.value.trim()) return;
    const kb = deps.getKb();
    if (!kb) return;
    testLoading.value = true;
    testAnswer.value = '';
    recallList.value = [];
    try {
      const question = testQuery.value;
      [testAnswer.value, recallList.value] = await Promise.all([
        queryKnowledgeBase(kb.id, question),
        fetchRecallByMode(kb.id, question),
      ]);
    } catch (error) {
      message.error(extractErrorMessage(error, $t('common.requestFailed')));
    } finally {
      testLoading.value = false;
    }
  }

  async function fetchRecallByMode(
    kbId: string,
    question: string,
  ): Promise<AiApi.KbSearchHit[]> {
    switch (testMode.value) {
      case 'multiple': {
        return searchKnowledgeBaseMultiple([kbId], question, 5).catch(() => []);
      }
      case 'rerank': {
        return searchKnowledgeBaseRerank(kbId, question, 5).catch(() => []);
      }
      default: {
        return searchKnowledgeBaseTest(kbId, question, 5).catch(() => []);
      }
    }
  }

  return {
    highlightKeywords,
    onTestQuery,
    recallList,
    recallStats,
    scoreColor,
    scoreTextColor,
    testAnswer,
    testLoading,
    testMode,
    testQuery,
  };
}
