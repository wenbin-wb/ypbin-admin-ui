<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, Col, Progress, Row, Statistic } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getDailyUsage, getUsageByModel, getUsageSummary } from '#/api/ai';
import { $t } from '#/locales';

import { useDailyColumns, useModelColumns } from './data';

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

onMounted(loadSummary);
</script>

<template>
  <Page auto-content-height>
    <div class="p-4">
      <Row :gutter="[16, 16]" class="mb-6">
        <Col :sm="8" :xs="24">
          <Card class="rounded-lg">
            <Statistic
              :loading="loading"
              :title="$t('page.ai.usage.totalCalls')"
              :value="summary.totalCalls"
            />
          </Card>
        </Col>
        <Col :sm="8" :xs="24">
          <Card class="rounded-lg">
            <Statistic
              :loading="loading"
              :title="$t('page.ai.usage.totalTokens')"
              :value="formatTokens(summary.totalTokens)"
            />
          </Card>
        </Col>
        <Col :sm="8" :xs="24">
          <Card class="rounded-lg">
            <Statistic
              :loading="loading"
              :title="$t('page.ai.usage.avgLatency')"
              :value="summary.avgLatencyMs"
              suffix="ms"
            />
          </Card>
        </Col>
      </Row>

      <Card :title="$t('page.ai.usage.daily')" class="mb-6" size="small">
        <DailyGrid>
          <template #dailyTokens="{ row }">
            <div class="flex items-center gap-3">
              <span class="w-16">{{ formatTokens(row.tokens) }}</span>
              <Progress
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
      </Card>

      <Card :title="$t('page.ai.usage.byModel')" size="small">
        <ModelGrid>
          <template #modelTokens="{ row }">
            {{ formatTokens(row.tokens) }}
          </template>
          <template #percent="{ row }">
            <Progress :percent="Math.min(100, Math.max(0, row.percent))" size="small" />
          </template>
        </ModelGrid>
      </Card>
    </div>
  </Page>
</template>