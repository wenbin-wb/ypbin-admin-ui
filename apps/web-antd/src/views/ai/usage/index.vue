<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getDailyUsage, getUsageByModel, getUsageSummary } from '#/api/ai';
import { $t } from '#/locales';

defineOptions({ name: 'AiUsage' });

const summary = ref({ avgLatencyMs: 0, totalCalls: 0, totalTokens: 0 });
const loading = ref(false);

async function loadSummary() {
  loading.value = true;
  try {
    summary.value = await getUsageSummary();
  } finally {
    loading.value = false;
  }
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// 每日用量表
const [DailyGrid] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'date', title: $t('page.ai.usage.date'), minWidth: 120 },
      {
        field: 'tokens',
        title: $t('page.ai.usage.tokens'),
        minWidth: 160,
        slots: { default: 'tokens' },
      },
    ],
    data: [],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async () => {
          const items = await getDailyUsage();
          return { items, total: items.length };
        },
      },
    },
    rowConfig: { keyField: 'date' },
    toolbarConfig: { refresh: true, zoom: true, export: false },
  } as VxeTableGridOptions<{ date: string; tokens: number }>,
});

// 按模型分布表
const [ModelGrid] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'model', title: $t('page.ai.usage.model'), minWidth: 140 },
      {
        field: 'tokens',
        title: $t('page.ai.usage.tokens'),
        minWidth: 140,
        slots: { default: 'tokens' },
      },
      {
        field: 'percent',
        title: $t('page.ai.usage.percent'),
        minWidth: 160,
        slots: { default: 'percent' },
      },
    ],
    data: [],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async () => {
          const items = await getUsageByModel();
          const total = items.reduce((s, m) => s + m.tokens, 0);
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
    toolbarConfig: { refresh: true, zoom: true, export: false },
  } as VxeTableGridOptions<{ model: string; percent: number; tokens: number }>,
});

function tokenPercent(percent: number) {
  return Math.min(100, Math.max(0, percent));
}

onMounted(() => {
  loadSummary();
});
</script>

<template>
  <Page auto-content-height>
    <div class="p-4">
      <!-- 概览卡片 -->
      <a-row :gutter="[16, 16]" class="mb-6">
        <a-col :sm="8" :xs="24">
          <a-card class="rounded-lg">
            <a-statistic
              :loading="loading"
              :title="$t('page.ai.usage.totalCalls')"
              :value="summary.totalCalls"
            />
          </a-card>
        </a-col>
        <a-col :sm="8" :xs="24">
          <a-card class="rounded-lg">
            <a-statistic
              :loading="loading"
              :title="$t('page.ai.usage.totalTokens')"
              :value="formatTokens(summary.totalTokens)"
            />
          </a-card>
        </a-col>
        <a-col :sm="8" :xs="24">
          <a-card class="rounded-lg">
            <a-statistic
              :loading="loading"
              :title="$t('page.ai.usage.avgLatency')"
              :value="summary.avgLatencyMs"
              suffix="ms"
            />
          </a-card>
        </a-col>
      </a-row>

      <!-- 每日用量 -->
      <a-card
        :title="$t('page.ai.usage.daily')"
        class="mb-6"
        size="small"
      >
        <DailyGrid>
          <template #tokens="{ row }">
            <div class="flex items-center gap-2">
              <span class="w-16">{{ formatTokens(row.tokens) }}</span>
              <a-progress
                :percent="
                  row.tokens > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (row.tokens / Math.max(summary.totalTokens, 1)) * 100,
                        ),
                      )
                    : 0
                "
                :show-info="false"
                class="flex-1"
                size="small"
              />
            </div>
          </template>
        </DailyGrid>
      </a-card>

      <!-- 按模型分布 -->
      <a-card :title="$t('page.ai.usage.byModel')" size="small">
        <ModelGrid>
          <template #tokens="{ row }">
            {{ formatTokens(row.tokens) }}
          </template>
          <template #percent="{ row }">
            <a-progress :percent="tokenPercent(row.percent)" size="small" />
          </template>
        </ModelGrid>
      </a-card>
    </div>
  </Page>
</template>
