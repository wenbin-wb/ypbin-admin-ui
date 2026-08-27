<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, Col, Empty, Row, Statistic } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getAiStatsDaily,
  getAiStatsHotQueries,
  getAiStatsKbDocs,
  getAiStatsSummary,
  getDailyUsage,
  getUsageByModel,
} from '#/api/ai';
import { $t } from '#/locales';

import { useDailyColumns, useModelColumns } from './data';

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

// 条形图归一化基准（至少 1，避免除零）
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

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
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

// 每日 Token 用量表
const [DailyGrid] = useVbenVxeGrid({
  gridOptions: {
    columns: useDailyColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          const items = await getDailyUsage();
          return { items, total: items.length };
        },
      },
    },
    rowConfig: { keyField: 'date' },
    toolbarConfig: {
      export: false,
      refresh: true,
      zoom: true,
    },
  } as VxeTableGridOptions<{ date: string; tokens: number }>,
});

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
    <div class="space-y-6 p-4">
      <!-- 概览卡片 -->
      <Row :gutter="[16, 16]">
        <Col :xs="12" :sm="12" :md="8" :lg="5">
          <Card class="rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <Statistic
              :loading="loading"
              :title="$t('page.ai.usage.kbCount')"
              :value="summary.kbCount"
            />
          </Card>
        </Col>
        <Col :xs="12" :sm="12" :md="8" :lg="5">
          <Card class="rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <Statistic
              :loading="loading"
              :title="$t('page.ai.usage.docTotal')"
              :value="summary.docTotal"
            />
          </Card>
        </Col>
        <Col :xs="12" :sm="12" :md="8" :lg="5">
          <Card class="rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <Statistic
              :loading="loading"
              :title="$t('page.ai.usage.chatCount')"
              :value="summary.chatCount"
            />
          </Card>
        </Col>
        <Col :xs="12" :sm="12" :md="8" :lg="5">
          <Card class="rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <Statistic
              :loading="loading"
              :title="$t('page.ai.usage.queryCount')"
              :value="summary.queryCount"
            />
          </Card>
        </Col>
        <Col :xs="24" :sm="12" :md="8" :lg="4">
          <Card class="rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <Statistic
              :loading="loading"
              :title="$t('page.ai.usage.totalTokens')"
              :value="formatTokens(summary.tokenTotal)"
            />
          </Card>
        </Col>
      </Row>

      <!-- 问答/检索趋势（近 30 天） -->
      <Card :title="$t('page.ai.usage.trend')" size="small">
        <div v-if="totalDaily > 0" class="flex items-end gap-1">
          <div
            v-for="(d, i) in daily"
            :key="d.date"
            class="group relative flex h-40 flex-1 flex-col justify-end"
          >
            <div class="flex flex-col justify-end gap-0.5">
              <div
                :style="{
                  height: `${(d.queryCount / maxDaily) * 100}px`,
                }"
                class="w-full rounded-sm bg-primary/60 transition-all group-hover:bg-primary"
                :title="`${d.date} ${$t('page.ai.usage.trendQuery')}: ${d.queryCount}`"
              ></div>
              <div
                :style="{
                  height: `${(d.chatCount / maxDaily) * 100}px`,
                }"
                class="w-full rounded-sm bg-violet-500/50 transition-all group-hover:bg-violet-500"
                :title="`${d.date} ${$t('page.ai.usage.trendChat')}: ${d.chatCount}`"
              ></div>
            </div>
            <span
              v-if="i % 5 === 0 || i === daily.length - 1"
              class="mt-1 text-center text-[10px] leading-none text-muted-foreground"
              >{{ d.date.slice(5) }}</span
            >
          </div>
        </div>
        <Empty
          v-else
          :description="$t('page.ai.usage.hotEmpty')"
          class="py-8"
        />
        <div class="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-sm bg-violet-500/50"></span>
            {{ $t('page.ai.usage.trendChat') }}
          </span>
          <span class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-sm bg-primary/60"></span>
            {{ $t('page.ai.usage.trendQuery') }}
          </span>
        </div>
      </Card>

      <!-- 搜索热词 + 文档分布 -->
      <Row :gutter="[16, 16]">
        <Col :xs="24" :lg="12">
          <Card :title="$t('page.ai.usage.hotQueries')" size="small">
            <div v-if="hotQueries.length" class="flex flex-col gap-2.5">
              <div v-for="h in hotQueries" :key="h.query" class="flex items-center gap-2">
                <span class="w-7 text-right text-xs font-medium text-muted-foreground">{{
                  h.count
                }}</span>
                <div class="h-5 flex-1 overflow-hidden rounded-md bg-muted/50">
                  <div
                    class="h-full rounded-md bg-primary/70 transition-all"
                    :style="{ width: `${(h.count / maxHot) * 100}%` }"
                  ></div>
                </div>
                <span class="max-w-56 truncate text-xs">{{ h.query }}</span>
              </div>
            </div>
            <Empty
              v-else
              :description="$t('page.ai.usage.hotEmpty')"
              class="py-8"
            />
          </Card>
        </Col>
        <Col :xs="24" :lg="12">
          <Card :title="$t('page.ai.usage.kbDistribution')" size="small">
            <div v-if="kbDocs.length" class="flex flex-col gap-2.5">
              <div v-for="k in kbDocs" :key="k.name" class="flex items-center gap-2">
                <span class="w-28 truncate text-xs">{{ k.name }}</span>
                <div class="h-5 flex-1 overflow-hidden rounded-md bg-muted/50">
                  <div
                    class="h-full rounded-md bg-emerald-500/60 transition-all"
                    :style="{ width: `${(k.docCount / maxKbDocs) * 100}%` }"
                  ></div>
                </div>
                <span class="w-12 text-right text-xs text-muted-foreground">
                  {{ k.docCount }} {{ $t('page.ai.usage.docsUnit') }}
                </span>
              </div>
            </div>
            <Empty
              v-else
              :description="$t('page.ai.usage.kbEmpty')"
              class="py-8"
            />
          </Card>
        </Col>
      </Row>

      <!-- 原有 Token 用量明细 -->
      <Row :gutter="[16, 16]">
        <Col :xs="24" :lg="12">
          <Card :title="$t('page.ai.usage.daily')" size="small">
            <DailyGrid>
              <template #dailyTokens="{ row }">
                <div class="flex items-center gap-3">
                  <span class="w-16">{{ formatTokens(row.tokens) }}</span>
                  <span
                    class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                  >
                    <span
                      class="block h-full rounded-full bg-primary/70"
                      :style="{
                        width: `${Math.min(100, Math.round((row.tokens / Math.max(summary.tokenTotal, 1)) * 100))}%`,
                      }"
                    ></span>
                  </span>
                </div>
              </template>
            </DailyGrid>
          </Card>
        </Col>
        <Col :xs="24" :lg="12">
          <Card :title="$t('page.ai.usage.byModel')" size="small">
            <ModelGrid>
              <template #modelTokens="{ row }">
                {{ formatTokens(row.tokens) }}
              </template>
              <template #percent="{ row }">
                <div class="flex items-center gap-2">
                  <span class="w-8 text-xs text-muted-foreground">{{
                    row.percent
                  }}%</span>
                  <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      class="block h-full rounded-full bg-primary/70"
                      :style="{ width: `${Math.min(100, Math.max(0, row.percent))}%` }"
                    ></span>
                  </span>
                </div>
              </template>
            </ModelGrid>
          </Card>
        </Col>
      </Row>
    </div>
  </Page>
</template>
