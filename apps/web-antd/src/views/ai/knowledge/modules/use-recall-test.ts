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
 * 极简 HTML 转义（& < > " '）。
 * 知识库片段原文来自外部文档，可能携带 <img onerror> 等载荷；
 * 任何要交给 v-html 渲染的文本都必须先整体转义，保证按纯文本呈现、不可注入标签。
 */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** <mark> 自产标签的 class（仅此标签由高亮函数插入，其余一律转义为纯文本） */
const HIGHLIGHT_MARK_CLASS =
  'rounded-sm bg-amber-200/80 px-0.5 text-inherit dark:bg-amber-500/30';

/**
 * 将命中的关键词在片段原文上高亮（长词优先，防嵌套替换）。
 *
 * 实现顺序：先在“原文”上用正则定位命中区间，再按区间把每个原文片段分别 escapeHtml
 * 后拼接，命中片段用 <mark> 包裹（内部内容同样转义）。在原文上匹配避免了在已转义文本
 * 中把关键词匹配进 HTML 实体（如 &amp;lt; 内部的 amp/lt），不会在 &lt; 内部插入标签；
 * 关键词的正则元字符转义同样作用于原文。安全约束：除自产的 <mark> 标签外，
 * 所有原文片段都经 escapeHtml 后输出，不可注入任何可执行 HTML。
 */
function highlightKeywords(text: string, keywords?: string[]) {
  const source = text ?? '';
  const escapedAll = escapeHtml(source);
  const list = keywords ?? [];
  if (list.length === 0 || !source) return escapedAll;
  // 在“原文”上过滤（长度以原始关键词计，发生在转义前），再对正则元字符转义；
  // 长词优先，防嵌套替换。
  const safePattern = list
    .filter((keyword) => keyword.length >= 2)
    .toSorted((a, b) => b.length - a.length)
    .map((keyword) =>
      keyword.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`),
    )
    .join('|');
  if (!safePattern) return escapedAll;
  const re = new RegExp(`(${safePattern})`, 'gi');
  let result = '';
  let lastIndex = 0;
  for (const match of source.matchAll(re)) {
    const index = match.index ?? 0;
    const keyword = match[0];
    // 非命中段转义 + 命中段转义后包 <mark>（仅此自产标签，其余全部转义为纯文本）
    result += escapeHtml(source.slice(lastIndex, index));
    result += `<mark class="${HIGHLIGHT_MARK_CLASS}">${escapeHtml(keyword)}</mark>`;
    lastIndex = index + keyword.length;
  }
  result += escapeHtml(source.slice(lastIndex));
  return result;
}

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
