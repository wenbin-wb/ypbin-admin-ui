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

/** 趋势窗口累计（与概览的「近 7 天事件」同口径） */
const trendTotal = computed(() =>
  trend.value.reduce((sum, item) => sum + Number(item.count), 0),
);

const trendStartDate = computed(
  () => trend.value[0]?.date.slice(5).replace('-', '/') ?? '',
);

/** 趋势柱高度占比（相对最大值，最低留 6% 以保持基线可见） */
const maxTrend = computed(() =>
  Math.max(1, ...trend.value.map((item) => Number(item.count))),
);

function barHeight(count: string): string {
  return `${Math.max(6, (Number(count) / maxTrend.value) * 100)}%`;
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
  <div class="mb-3 rounded-xl border bg-card p-4">
    <div v-if="loadFailed" class="text-sm text-muted-foreground">
      {{ $t('tracking.events.summaryLoadFailed') }}
    </div>
    <div v-else class="flex flex-col gap-4 xl:flex-row xl:items-stretch">
      <!-- 指标：每个指标一张浅底卡片，图标 + 标签 + 数值 -->
      <div class="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
          >
            <IconifyIcon icon="lucide:activity" class="size-4" />
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="truncate text-xs text-muted-foreground">
              {{ $t('tracking.events.todayEvents') }}
            </span>
            <span class="truncate text-xl font-semibold tabular-nums">
              {{ overview?.todayEvents ?? '-' }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600"
          >
            <IconifyIcon icon="lucide:calendar-range" class="size-4" />
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="truncate text-xs text-muted-foreground">
              {{ $t('tracking.events.weekEvents') }}
            </span>
            <span class="truncate text-xl font-semibold tabular-nums">
              {{ overview?.weekEvents ?? '-' }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-md"
            :class="
              hasFailures
                ? 'bg-destructive/10 text-destructive'
                : 'bg-emerald-500/10 text-emerald-600'
            "
          >
            <IconifyIcon
              :icon="
                hasFailures ? 'lucide:circle-alert' : 'lucide:shield-check'
              "
              class="size-4"
            />
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="truncate text-xs text-muted-foreground">
              {{ $t('tracking.events.weekFailRate') }}
            </span>
            <span
              class="truncate text-xl font-semibold tabular-nums"
              :class="hasFailures ? 'text-destructive' : ''"
            >
              {{ failRate }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-md bg-violet-500/10 text-violet-600"
          >
            <IconifyIcon icon="lucide:users" class="size-4" />
          </span>
          <div class="flex min-w-0 flex-col">
            <span class="truncate text-xs text-muted-foreground">
              {{ $t('tracking.events.weekUsers') }}
            </span>
            <span class="truncate text-xl font-semibold tabular-nums">
              {{ overview?.weekUsers ?? '-' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 趋势：固定宽度的小图，带起止日期与合计 -->
      <div
        class="flex w-full shrink-0 flex-col gap-1.5 border-t pt-3 xl:w-80 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"
      >
        <div class="flex items-baseline justify-between">
          <span class="text-xs text-muted-foreground">
            {{ $t('tracking.events.trendTitle', [TREND_DAYS]) }}
          </span>
          <span class="text-xs text-muted-foreground tabular-nums">
            {{ $t('tracking.events.trendTotal', [trendTotal]) }}
          </span>
        </div>
        <div class="flex h-14 items-end gap-1">
          <div
            v-for="item in trend"
            :key="item.date"
            class="flex-1 rounded-t bg-primary/25 transition-colors hover:bg-primary/60"
            :style="{ height: barHeight(item.count) }"
            :title="`${item.date} · ${item.count}`"
          ></div>
        </div>
        <div class="flex justify-between text-[11px] text-muted-foreground">
          <span class="tabular-nums">{{ trendStartDate }}</span>
          <span>{{ $t('tracking.events.trendToday') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
