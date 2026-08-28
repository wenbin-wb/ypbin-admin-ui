<script lang="ts" setup>
import type { TabOption } from '@vben/types';

import { computed, onMounted, ref } from 'vue';

import { AnalysisChartCard, AnalysisChartsTabs } from '@vben/common-ui';
import {
  SvgBellIcon,
  SvgCakeIcon,
  SvgCardIcon,
  SvgDownloadIcon,
} from '@vben/icons';

import { getDashboardStats } from '#/api';
import { $t } from '#/locales';

import AnalyticsTrends from './analytics-trends.vue';
import AnalyticsVisitsData from './analytics-visits-data.vue';
import AnalyticsVisitsSales from './analytics-visits-sales.vue';
import AnalyticsVisitsSource from './analytics-visits-source.vue';
import AnalyticsVisits from './analytics-visits.vue';

// ---- 统一视觉（与统计看板/工作台同一套语言）----
const BRAND_GRAD =
  'linear-gradient(135deg, hsl(var(--primary)), hsl(245 82% 67%))';

const stats = ref({
  userCount: 0,
  roleCount: 0,
  deptCount: 0,
  menuCount: 0,
  onlineCount: 0,
  logCount: 0,
});

const overviewCards = computed(() => [
  {
    key: 'user',
    icon: SvgCardIcon,
    title: $t('page.dashboard.user'),
    value: stats.value.userCount,
    total: $t('page.dashboard.role'),
    totalValue: stats.value.roleCount,
    grad: 'linear-gradient(135deg, hsl(var(--primary)), hsl(245 82% 67%))',
    glow: 'hsl(var(--primary) / 30%)',
  },
  {
    key: 'dept',
    icon: SvgCakeIcon,
    title: $t('page.dashboard.dept'),
    value: stats.value.deptCount,
    total: $t('page.dashboard.menu'),
    totalValue: stats.value.menuCount,
    grad: 'linear-gradient(135deg, hsl(245 82% 67%), hsl(161 90% 43%))',
    glow: 'hsl(245 82% 67% / 30%)',
  },
  {
    key: 'online',
    icon: SvgDownloadIcon,
    title: $t('page.dashboard.online'),
    value: stats.value.onlineCount,
    total: $t('page.dashboard.logs'),
    totalValue: stats.value.logCount,
    grad: 'linear-gradient(135deg, hsl(199 89% 48%), hsl(161 90% 43%))',
    glow: 'hsl(199 89% 48% / 30%)',
  },
  {
    key: 'usage',
    icon: SvgBellIcon,
    title: $t('page.dashboard.menu'),
    value: stats.value.menuCount,
    total: $t('page.dashboard.dept'),
    totalValue: stats.value.deptCount,
    grad: 'linear-gradient(135deg, hsl(32 95% 44%), hsl(16 90% 50%))',
    glow: 'hsl(32 95% 44% / 30%)',
  },
]);

const chartTabs: TabOption[] = [
  {
    label: $t('page.dashboard.trend'),
    value: 'trends',
  },
  {
    label: $t('page.dashboard.visitTab'),
    value: 'visits',
  },
];

// 页头：日期
const now = computed(() => {
  const d = new Date();
  const week = [
    $t('page.dashboard.sunday'),
    $t('page.dashboard.monday'),
    $t('page.dashboard.tuesday'),
    $t('page.dashboard.wednesday'),
    $t('page.dashboard.thursday'),
    $t('page.dashboard.friday'),
    $t('page.dashboard.saturday'),
  ];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${week[d.getDay()]}`;
});

const dayBadges = computed(() => [
  { label: $t('page.dashboard.user'), value: String(stats.value.userCount) },
  { label: $t('page.dashboard.role'), value: String(stats.value.roleCount) },
  { label: $t('page.dashboard.online'), value: String(stats.value.onlineCount) },
  { label: $t('page.dashboard.logs'), value: String(stats.value.logCount) },
]);

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

onMounted(async () => {
  try {
    const data = await getDashboardStats();
    stats.value = { ...stats.value, ...data };
  } catch (error) {
    console.error('Failed to load dashboard stats:', error);
  }
});
</script>

<template>
  <div class="p-5">
    <!-- 炫彩浅色页头：淡渐变底 + 光斑 + 徽章 -->
    <div
      class="relative overflow-hidden rounded-2xl border border-border/70 px-6 py-5"
      style="
        background: linear-gradient(
          120deg,
          hsl(var(--primary) / 10%),
          hsl(245 82% 67% / 8%) 50%,
          hsl(199 89% 48% / 10%)
        );
      "
    >
      <span
        class="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full opacity-40 blur-3xl"
        style="background: hsl(245 82% 67% / 35%)"
      ></span>
      <span
        class="pointer-events-none absolute -bottom-14 right-40 size-36 rounded-full opacity-30 blur-3xl"
        style="background: hsl(var(--primary) / 35%)"
      ></span>
      <div class="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-xs text-muted-foreground">{{ now }}</p>
          <h2 class="mt-1 text-2xl font-bold tracking-tight">
            {{ $t('page.dashboard.analyticsTitle') }}
          </h2>
          <p class="mt-1 text-sm text-muted-foreground">
            {{ $t('page.dashboard.analyticsSubtitle') }}
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <div
            v-for="b in dayBadges"
            :key="b.label"
            class="rounded-xl border border-border/70 bg-background/70 px-4 py-2 shadow-sm backdrop-blur"
          >
            <p class="text-xs text-muted-foreground">{{ b.label }}</p>
            <p
              class="mt-0.5 text-lg font-bold tabular-nums leading-none"
              :style="{
                background: BRAND_GRAD,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }"
            >
              {{ b.value }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 指标卡（炫彩：渐变图标 + 光晕 + 大数字） -->
    <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="c in overviewCards"
        :key="c.key"
        class="metric-card group relative overflow-hidden rounded-xl border border-border/80 bg-card p-5"
        :style="{ '--glow': c.glow }"
      >
        <span
          class="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-80"
          :style="{ background: c.grad }"
        ></span>
        <div class="relative flex items-start justify-between">
          <div>
            <p class="text-sm text-muted-foreground">{{ c.title }}</p>
            <p
              class="mt-2 text-3xl font-bold tabular-nums leading-none tracking-tight"
              :style="{
                background: c.grad,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }"
            >
              {{ fmt(c.value) }}
            </p>
          </div>
          <span
            class="inline-flex size-10 items-center justify-center rounded-xl text-white shadow-lg"
            :style="{ background: c.grad, boxShadow: `0 8px 20px ${c.glow}` }"
          >
            <component :is="c.icon" class="size-5" />
          </span>
        </div>
        <div
          class="relative mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-xs text-muted-foreground"
        >
          <span>{{ c.total }}</span>
          <span class="font-semibold tabular-nums">{{ fmt(c.totalValue) }}</span>
        </div>
      </div>
    </div>

    <AnalysisChartsTabs :tabs="chartTabs" class="mt-5">
      <template #trends>
        <AnalyticsTrends />
      </template>
      <template #visits>
        <AnalyticsVisits />
      </template>
    </AnalysisChartsTabs>

    <div class="mt-5 w-full md:flex">
      <AnalysisChartCard
        class="mt-5 md:mt-0 md:mr-4 md:w-1/3"
        :title="$t('page.dashboard.visitData')"
      >
        <AnalyticsVisitsData />
      </AnalysisChartCard>
      <AnalysisChartCard
        class="mt-5 md:mt-0 md:mr-4 md:w-1/3"
        :title="$t('page.dashboard.visitSource')"
      >
        <AnalyticsVisitsSource />
      </AnalysisChartCard>
      <AnalysisChartCard
        class="mt-5 md:mt-0 md:w-1/3"
        :title="$t('page.dashboard.sales')"
      >
        <AnalyticsVisitsSales />
      </AnalysisChartCard>
    </div>
  </div>
</template>

<style scoped>
.metric-card {
  animation: metric-in 0.4s ease-out both;
  transition:
    transform 0.25s ease,
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}
.metric-card:hover {
  transform: translateY(-2px);
  border-color: hsl(var(--primary) / 40%);
  box-shadow:
    0 8px 24px hsl(var(--foreground) / 8%),
    0 0 24px var(--glow);
}
@keyframes metric-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
