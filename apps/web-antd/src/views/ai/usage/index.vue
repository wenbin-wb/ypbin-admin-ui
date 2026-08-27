<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, Col, Empty, Row, Skeleton } from 'ant-design-vue';

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

defineOptions({ name: 'AiUsage' });

const loading = ref(false);
const summary = ref({
  kbCount: 0,
  docTotal: 0,
  chatCount: 0,
  queryCount: 0,
  tokenTotal: 0,
});

const daily = ref<
  Array<{ date: string; chatCount: number; queryCount: number; tokenCount: number }>
>([]);
const hotQueries = ref<Array<{ query: string; count: number }>>([]);
const kbDocs = ref<Array<{ name: string; docCount: number }>>([]);

// 归一化基准（至少 1，避免除零）
const maxDaily = computed(() =>
  Math.max(1, ...daily.value.map((d) => Math.max(d.chatCount, d.queryCount))),
);
const maxHot = computed(() => Math.max(1, ...hotQueries.value.map((h) => h.count)));
const maxKbDocs = computed(() =>
  Math.max(1, ...kbDocs.value.map((k) => k.docCount)),
);
const totalDaily = computed(() =>
  daily.value.reduce((s, d) => s + d.chatCount + d.queryCount, 0),
);

/** 5 个概览指标（label/value），供指标条渲染 */
const metrics = computed(() => [
  { label: $t('page.ai.usage.kbCount'), value: String(summary.value.kbCount) },
  { label: $t('page.ai.usage.docTotal'), value: String(summary.value.docTotal) },
  { label: $t('page.ai.usage.chatCount'), value: String(summary.value.chatCount) },
  { label: $t('page.ai.usage.queryCount'), value: String(summary.value.queryCount) },
  {
    label: $t('page.ai.usage.totalTokens'),
    value: formatTokens(summary.value.tokenTotal),
  },
]);

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

/** 柱高百分比（0-100%） */
function barPct(value: number, max: number) {
  return `${Math.round((value / max) * 100)}%`;
}

/** 趋势底部标签：每 5 天显示一次，其余占位保持对齐 */
function showTick(i: number) {
  return i % 5 === 0 || i === daily.value.length - 1;
}

/** 热词名次强调：前三名用主色加深，其余弱化 */
function rankClass(i: number) {
  if (i === 0) return 'text-primary';
  if (i === 1) return 'text-primary/70';
  if (i === 2) return 'text-primary/50';
  return 'text-muted-foreground/60';
}

function barClass(i: number) {
  if (i === 0) return 'bg-primary';
  if (i === 1) return 'bg-primary/70';
  if (i === 2) return 'bg-primary/50';
  return 'bg-primary/30';
}

async function loadStats() {
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
  } finally {
    loading.value = false;
  }
}

// 按模型分布表
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
    toolbarConfig: {
      export: false,
      refresh: true,
      zoom: true,
    },
  } as VxeTableGridOptions<{ model: string; percent: number; tokens: number }>,
});

onMounted(loadStats);
</script>

<template>
  <Page auto-content-height>
    <div class="space-y-5 p-5">
      <!-- 概览指标条（单一容器，间距即分隔） -->
      <div class="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border bg-card px-6 py-5 sm:grid-cols-3 lg:grid-cols-5">
        <div v-for="m in metrics" :key="m.label" class="min-w-0">
          <p class="truncate text-xs text-muted-foreground">{{ m.label }}</p>
          <p class="mt-1.5 truncate text-2xl font-semibold tabular-nums tracking-tight">
            <Skeleton v-if="loading" :paragraph="false" :title="{ width: 56 }" active class="!w-16" />
            <template v-else>{{ m.value }}</template>
          </p>
        </div>
      </div>

      <!-- 趋势 + 热词 -->
      <Row :gutter="[16, 16]">
        <Col :xs="24" :lg="16">
          <Card :title="$t('page.ai.usage.trend')" size="small">
            <template v-if="loading">
              <Skeleton :paragraph="{ rows: 6 }" active />
            </template>
            <template v-else-if="totalDaily > 0">
              <div class="flex h-44 items-end gap-[3px]">
                <div
                  v-for="d in daily"
                  :key="d.date"
                  class="group relative flex h-full flex-1 flex-col justify-end gap-[2px]"
                  :title="`${d.date} ${$t('page.ai.usage.trendQuery')}: ${d.queryCount} / ${$t('page.ai.usage.trendChat')}: ${d.chatCount}`"
                >
                  <div
                    class="w-full rounded-t-[3px] bg-primary/35 transition-colors group-hover:bg-primary/55"
                    :style="{ height: barPct(d.queryCount, maxDaily) }"
                  ></div>
                  <div
                    class="w-full rounded-t-[3px] bg-primary transition-colors group-hover:bg-primary/85"
                    :style="{ height: barPct(d.chatCount, maxDaily) }"
                  ></div>
                </div>
              </div>
              <div class="mt-1.5 flex">
                <span
                  v-for="(d, i) in daily"
                  :key="d.date"
                  class="flex-1 text-center text-[10px] leading-none text-muted-foreground"
                  :class="showTick(i) ? '' : 'invisible'"
                  >{{ d.date.slice(5) }}</span
                >
              </div>
              <div class="mt-3 flex items-center gap-5 border-t border-border pt-3 text-xs text-muted-foreground">
                <span class="flex items-center gap-1.5">
                  <span class="size-2 rounded-sm bg-primary"></span>
                  {{ $t('page.ai.usage.trendChat') }}
                </span>
                <span class="flex items-center gap-1.5">
                  <span class="size-2 rounded-sm bg-primary/35"></span>
                  {{ $t('page.ai.usage.trendQuery') }}
                </span>
              </div>
            </template>
            <Empty v-else :description="$t('page.ai.usage.hotEmpty')" class="py-10" />
          </Card>
        </Col>
        <Col :xs="24" :lg="8">
          <Card :title="$t('page.ai.usage.hotQueries')" size="small">
            <template v-if="loading">
              <Skeleton :paragraph="{ rows: 6 }" active />
            </template>
            <template v-else-if="hotQueries.length">
              <div class="flex flex-col">
                <div
                  v-for="(h, i) in hotQueries"
                  :key="h.query"
                  class="flex items-center gap-3 py-1.5"
                >
                  <span class="w-5 shrink-0 text-center text-sm font-semibold tabular-nums" :class="rankClass(i)">{{
                    i + 1
                  }}</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                      <span class="truncate text-sm">{{ h.query }}</span>
                      <span class="shrink-0 text-xs text-muted-foreground tabular-nums">{{
                        h.count
                      }}</span>
                    </div>
                    <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/60">
                      <div
                        class="h-full rounded-full transition-all"
                        :class="barClass(i)"
                        :style="{ width: barPct(h.count, maxHot) }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <Empty v-else :description="$t('page.ai.usage.hotEmpty')" class="py-10" />
          </Card>
        </Col>
      </Row>

      <!-- 文档分布 + 按模型分布 -->
      <Row :gutter="[16, 16]">
        <Col :xs="24" :lg="12">
          <Card :title="$t('page.ai.usage.kbDistribution')" size="small">
            <template v-if="loading">
              <Skeleton :paragraph="{ rows: 5 }" active />
            </template>
            <template v-else-if="kbDocs.length">
              <div class="flex flex-col gap-3">
                <div v-for="k in kbDocs" :key="k.name" class="flex items-center gap-3">
                  <span class="w-32 shrink-0 truncate text-sm">{{ k.name }}</span>
                  <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                    <div
                      class="h-full rounded-full bg-primary/50 transition-all"
                      :style="{ width: barPct(k.docCount, maxKbDocs) }"
                    ></div>
                  </div>
                  <span class="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {{ k.docCount }} {{ $t('page.ai.usage.docsUnit') }}
                  </span>
                </div>
              </div>
            </template>
            <Empty v-else :description="$t('page.ai.usage.kbEmpty')" class="py-10" />
          </Card>
        </Col>
        <Col :xs="24" :lg="12">
          <Card :title="$t('page.ai.usage.byModel')" size="small">
            <ModelGrid>
              <template #modelTokens="{ row }">
                <span class="tabular-nums">{{ formatTokens(row.tokens) }}</span>
              </template>
              <template #percent="{ row }">
                <div class="flex items-center gap-2">
                  <span class="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{{
                    row.percent
                  }}%</span>
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                    <div
                      class="h-full rounded-full bg-primary/70 transition-all"
                      :style="{ width: `${Math.min(100, Math.max(0, row.percent))}%` }"
                    ></div>
                  </div>
                </div>
              </template>
            </ModelGrid>
          </Card>
        </Col>
      </Row>
    </div>
  </Page>
</template>
