<script lang="ts" setup>
import type { SystemTrackingApi } from '#/api/system/tracking';

import { computed, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { getTrackOverview, getTrackTrend } from '#/api/system/tracking';
import { $t } from '#/locales';

const overview = ref<null | SystemTrackingApi.TrackOverview>(null);
const trend = ref<SystemTrackingApi.TrackTrend[]>([]);
const loadFailed = ref(false);

const TREND_DAYS = 7;

/** 近 7 天失败率（百分比，保留一位小数） */
const failRate = computed(() => {
  const total = Number(overview.value?.weekEvents ?? 0);
  const failures = Number(overview.value?.weekFailures ?? 0);
  if (total === 0) {
    return '0.0%';
  }
  return `${((failures / total) * 100).toFixed(1)}%`;
});

const hasFailures = computed(
  () => Number(overview.value?.weekFailures ?? 0) > 0,
);

/** 趋势柱高度占比（相对最大值，最低留 4% 以保持基线可见） */
const maxTrend = computed(() =>
  Math.max(1, ...trend.value.map((item) => Number(item.count))),
);

function barHeight(count: string): string {
  return `${Math.max(4, (Number(count) / maxTrend.value) * 100)}%`;
}

async function load() {
  loadFailed.value = false;
  try {
    const [overviewData, trendData] = await Promise.all([
      getTrackOverview(),
      getTrackTrend(TREND_DAYS),
    ]);
    overview.value = overviewData;
    trend.value = trendData;
  } catch (error) {
    // 全局请求拦截器已给出错误提示；这里保留可视的降级状态，避免页面看起来"全是 0"
    console.error('Failed to load tracking summary:', error);
    loadFailed.value = true;
  }
}

onMounted(load);

defineExpose({ reload: load });
</script>

<template>
  <div class="mb-3 rounded-lg border bg-card p-4">
    <div v-if="loadFailed" class="text-sm text-muted-foreground">
      {{ $t('tracking.events.summaryLoadFailed') }}
    </div>
    <div v-else class="flex flex-wrap items-stretch gap-x-8 gap-y-4">
      <!-- 指标 -->
      <div class="flex min-w-24 flex-col gap-1">
        <span class="text-xs text-muted-foreground">
          {{ $t('tracking.events.todayEvents') }}
        </span>
        <span class="text-2xl font-semibold tabular-nums">
          {{ overview?.todayEvents ?? '-' }}
        </span>
      </div>
      <div class="flex min-w-24 flex-col gap-1">
        <span class="text-xs text-muted-foreground">
          {{ $t('tracking.events.weekEvents') }}
        </span>
        <span class="text-2xl font-semibold tabular-nums">
          {{ overview?.weekEvents ?? '-' }}
        </span>
      </div>
      <div class="flex min-w-24 flex-col gap-1">
        <span class="text-xs text-muted-foreground">
          {{ $t('tracking.events.weekFailRate') }}
        </span>
        <span
          class="flex items-center gap-1 text-2xl font-semibold tabular-nums"
          :class="hasFailures ? 'text-destructive' : ''"
        >
          {{ failRate }}
          <IconifyIcon
            v-if="hasFailures"
            icon="lucide:triangle-alert"
            class="size-4"
          />
        </span>
      </div>
      <div class="flex min-w-24 flex-col gap-1">
        <span class="text-xs text-muted-foreground">
          {{ $t('tracking.events.weekUsers') }}
        </span>
        <span class="text-2xl font-semibold tabular-nums">
          {{ overview?.weekUsers ?? '-' }}
        </span>
      </div>

      <!-- 趋势 -->
      <div class="flex min-w-64 flex-1 flex-col gap-2">
        <span class="text-xs text-muted-foreground">
          {{ $t('tracking.events.trendTitle', [TREND_DAYS]) }}
        </span>
        <div class="flex h-12 items-end gap-1 border-b border-border/60 pb-0.5">
          <div
            v-for="item in trend"
            :key="item.date"
            class="flex-1 rounded-sm bg-primary/60 transition-colors hover:bg-primary"
            :style="{ height: barHeight(item.count) }"
            :title="`${item.date} · ${item.count}`"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>
