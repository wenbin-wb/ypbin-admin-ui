import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getAiStatsDaily,
  getAiStatsHotQueries,
  getAiStatsKbDocs,
  getAiStatsSummary,
  getUsageByModel,
} from '#/api/ai';
import { $t } from '#/locales';

import { useModelColumns } from './data';

/**
 * AI 用量统计域：总览/日趋势/热门问答/文档分布/按模型用量 的数据加载、
 * 归一化与派生指标。页面组件只负责把派生结果渲染成卡片与图表。
 */
export function useAiStats() {
  const loading = ref(false);
  const summary = ref({
    kbCount: 0,
    docTotal: 0,
    chatCount: 0,
    queryCount: 0,
    tokenTotal: 0,
  });

  const daily = ref<
    Array<{
      chatCount: number;
      date: string;
      queryCount: number;
      tokenCount: number;
    }>
  >([]);
  const hotQueries = ref<Array<{ count: number; query: string }>>([]);
  const kbDocs = ref<Array<{ docCount: number; name: string }>>([]);

  // 归一化基准（至少 1，避免除零）
  const maxDaily = computed(() =>
    Math.max(1, ...daily.value.map((d) => Math.max(d.chatCount, d.queryCount))),
  );
  const maxHot = computed(() =>
    Math.max(1, ...hotQueries.value.map((h) => h.count)),
  );
  const maxKbDocs = computed(() =>
    Math.max(1, ...kbDocs.value.map((k) => k.docCount)),
  );
  const totalDaily = computed(() =>
    daily.value.reduce((s, d) => s + d.chatCount + d.queryCount, 0),
  );
  // 30 天汇总（问答/检索/Token）
  const sumChat = computed(() =>
    daily.value.reduce((s, d) => s + d.chatCount, 0),
  );
  const sumQuery = computed(() =>
    daily.value.reduce((s, d) => s + d.queryCount, 0),
  );
  const sumToken = computed(() =>
    daily.value.reduce((s, d) => s + d.tokenCount, 0),
  );
  // 文档分布总数
  const kbDocsTotal = computed(() =>
    kbDocs.value.reduce((s, k) => s + k.docCount, 0),
  );

  // ---- 概览指标（统一品牌渐变图标，仅图标区分语义）----
  const metrics = computed(() => [
    {
      key: 'kbCount',
      label: $t('page.ai.usage.kbCount'),
      value: summary.value.kbCount,
      icon: 'i-lucide-database',
    },
    {
      key: 'docTotal',
      label: $t('page.ai.usage.docTotal'),
      value: summary.value.docTotal,
      icon: 'i-lucide-file-text',
    },
    {
      key: 'chatCount',
      label: $t('page.ai.usage.chatCount'),
      value: summary.value.chatCount,
      icon: 'i-lucide-message-square',
    },
    {
      key: 'queryCount',
      label: $t('page.ai.usage.queryCount'),
      value: summary.value.queryCount,
      icon: 'i-lucide-search',
    },
    {
      key: 'tokenTotal',
      label: $t('page.ai.usage.totalTokens'),
      value: summary.value.tokenTotal,
      icon: 'i-lucide-zap',
    },
  ]);

  async function loadStats(onSummaryLoaded?: () => void) {
    loading.value = true;
    try {
      const [s, d, h, k] = await Promise.all([
        getAiStatsSummary(),
        getAiStatsDaily(30),
        getAiStatsHotQueries(10),
        getAiStatsKbDocs(),
      ]);
      summary.value = s;
      daily.value = d;
      hotQueries.value = h;
      kbDocs.value = k;
      onSummaryLoaded?.();
    } finally {
      loading.value = false;
    }
  }

  const [ModelGrid] = useVbenVxeGrid({
    gridOptions: {
      columns: useModelColumns(),
      height: 'auto',
      keepSource: true,
      proxyConfig: {
        ajax: {
          query: async () => {
            const items = await getUsageByModel();
            const total = items.reduce((sum, m) => sum + m.tokens, 0);
            return {
              items: items.map((m) => ({
                ...m,
                percent: total > 0 ? Math.round((m.tokens / total) * 100) : 0,
              })),
              total: items.length,
            };
          },
        },
      },
      rowConfig: { keyField: 'model' },
      toolbarConfig: { export: false, refresh: true, zoom: true },
    } as VxeTableGridOptions<{
      model: string;
      percent: number;
      tokens: number;
    }>,
  });

  return {
    daily,
    hotQueries,
    kbDocs,
    kbDocsTotal,
    loadStats,
    loading,
    maxDaily,
    maxHot,
    maxKbDocs,
    metrics,
    ModelGrid,
    summary,
    sumChat,
    sumQuery,
    sumToken,
    totalDaily,
  };
}
