<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { getDailyUsage, getUsageByModel, getUsageSummary } from '#/api/ai';
import { $t } from '#/locales';

defineOptions({ name: 'AiUsage' });

const summary = ref({ totalCalls: 0, totalTokens: 0, avgLatencyMs: 0 });
const dailyData = ref<Array<{ date: string; tokens: number }>>([]);
const modelData = ref<Array<{ model: string; tokens: number }>>([]);
const loading = ref(false);

async function loadData() {
  loading.value = true;
  try {
    const [s, d, m] = await Promise.all([
      getUsageSummary(),
      getDailyUsage(),
      getUsageByModel(),
    ]);
    summary.value = s;
    dailyData.value = d;
    modelData.value = m;
  } finally {
    loading.value = false;
  }
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

onMounted(loadData);
</script>

<template>
  <div class="p-4">
    <div class="mb-6 flex items-center justify-between">
      <h2 class="text-lg font-semibold">
        {{ $t('page.ai.usage.title') }}
      </h2>
      <a-button :loading="loading" @click="loadData">
        {{ $t('page.ai.usage.refresh') }}
      </a-button>
    </div>

    <!-- 概览卡片 -->
    <a-row :gutter="[16, 16]" class="mb-6">
      <a-col :xs="24" :sm="8">
        <a-statistic
          :title="$t('page.ai.usage.totalCalls')"
          :value="summary.totalCalls"
          class="rounded-lg border p-4"
        />
      </a-col>
      <a-col :xs="24" :sm="8">
        <a-statistic
          :title="$t('page.ai.usage.totalTokens')"
          :value="formatTokens(summary.totalTokens)"
          class="rounded-lg border p-4"
        />
      </a-col>
      <a-col :xs="24" :sm="8">
        <a-statistic
          :title="$t('page.ai.usage.avgLatency')"
          :value="summary.avgLatencyMs"
          suffix="ms"
          class="rounded-lg border p-4"
        />
      </a-col>
    </a-row>

    <!-- 每日用量 -->
    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="14">
        <div class="rounded-lg border p-4">
          <div class="mb-3 font-medium">
            {{ $t('page.ai.usage.daily') }}
          </div>
          <a-table
            :data-source="dailyData"
            row-key="date"
            size="small"
            :pagination="{ pageSize: 10, size: 'small' }"
          >
            <a-table-column
              :title="$t('page.ai.usage.date')"
              data-index="date"
            />
            <a-table-column :title="$t('page.ai.usage.tokens')">
              <template #default="{ record }">
                {{ formatTokens(record.tokens) }}
                <a-progress
                  :percent="
                    dailyData.length
                      ? Math.round(
                          (record.tokens /
                            Math.max(...dailyData.map((d) => d.tokens))) *
                            100,
                        )
                      : 0
                  "
                  :show-info="false"
                  size="small"
                  class="mt-1"
                />
              </template>
            </a-table-column>
          </a-table>
        </div>
      </a-col>

      <a-col :xs="24" :lg="10">
        <div class="rounded-lg border p-4">
          <div class="mb-3 font-medium">
            {{ $t('page.ai.usage.byModel') }}
          </div>
          <a-table
            :data-source="modelData"
            row-key="model"
            size="small"
            :pagination="false"
          >
            <a-table-column
              :title="$t('page.ai.usage.model')"
              data-index="model"
            />
            <a-table-column :title="$t('page.ai.usage.tokens')">
              <template #default="{ record }">
                {{ formatTokens(record.tokens) }}
              </template>
            </a-table-column>
            <a-table-column :title="$t('page.ai.usage.percent')">
              <template #default="{ record }">
                <a-progress
                  :percent="
                    modelData.length
                      ? Math.round(
                          (record.tokens /
                            modelData.reduce((s, m) => s + m.tokens, 0)) *
                            100,
                        )
                      : 0
                  "
                  size="small"
                />
              </template>
            </a-table-column>
          </a-table>
        </div>
      </a-col>
    </a-row>
  </div>
</template>
