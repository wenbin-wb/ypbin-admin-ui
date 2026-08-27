<script lang="ts" setup>
import type { AnalysisOverviewItem } from '@vben/common-ui';
import type { TabOption } from '@vben/types';

import { computed } from 'vue';

import {
  AnalysisChartCard,
  AnalysisChartsTabs,
  AnalysisOverview,
} from '@vben/common-ui';
import {
  SvgBellIcon,
  SvgCakeIcon,
  SvgCardIcon,
  SvgDownloadIcon,
} from '@vben/icons';

import { $t } from '#/locales';

import AnalyticsTrends from './analytics-trends.vue';
import AnalyticsVisitsData from './analytics-visits-data.vue';
import AnalyticsVisitsSales from './analytics-visits-sales.vue';
import AnalyticsVisitsSource from './analytics-visits-source.vue';
import AnalyticsVisits from './analytics-visits.vue';

const overviewItems: AnalysisOverviewItem[] = [
  {
    icon: SvgCardIcon,
    title: $t('page.dashboard.user'),
    totalTitle: $t('page.dashboard.userTotal'),
    totalValue: 120_000,
    value: 2000,
  },
  {
    icon: SvgCakeIcon,
    title: $t('page.dashboard.visit'),
    totalTitle: $t('page.dashboard.visitTotal'),
    totalValue: 500_000,
    value: 20_000,
  },
  {
    icon: SvgDownloadIcon,
    title: $t('page.dashboard.download'),
    totalTitle: $t('page.dashboard.downloadTotal'),
    totalValue: 120_000,
    value: 8000,
  },
  {
    icon: SvgBellIcon,
    title: $t('page.dashboard.usage'),
    totalTitle: $t('page.dashboard.usageTotal'),
    totalValue: 50_000,
    value: 5000,
  },
];

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

// 欢迎横幅：日期 + 问候 + 当日徽章
const now = computed(() => {
  const d = new Date();
  const week = [
    '周日',
    '周一',
    '周二',
    '周三',
    '周四',
    '周五',
    '周六',
  ];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${week[d.getDay()]}`;
});

const dayBadges = [
  { label: '今日访问', value: '2,048' },
  { label: '今日会话', value: '486' },
  { label: '今日问答', value: '128' },
  { label: '在线人数', value: '36' },
];
</script>

<template>
  <div class="p-5">
    <!-- 渐变欢迎横幅 -->
    <div
      class="relative overflow-hidden rounded-xl border border-primary/20 p-6"
      style="
        background: linear-gradient(
          120deg,
          hsl(var(--primary) / 14%),
          hsl(262 83% 62% / 10%) 45%,
          hsl(199 89% 48% / 12%)
        );
      "
    >
      <span
        class="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full opacity-30 blur-3xl"
        style="background: hsl(262 83% 62% / 45%)"
      ></span>
      <span
        class="pointer-events-none absolute -bottom-12 right-32 size-36 rounded-full opacity-25 blur-3xl"
        style="background: hsl(199 89% 48% / 40%)"
      ></span>
      <div class="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-xs text-muted-foreground">{{ now }}</p>
          <h2 class="mt-1 text-xl font-semibold tracking-tight">数据分析总览</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            平台整体运行态势与趋势洞察（演示数据）
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <div
            v-for="b in dayBadges"
            :key="b.label"
            class="rounded-lg border border-border/70 bg-background/60 px-4 py-2 backdrop-blur"
          >
            <p class="text-xs text-muted-foreground">{{ b.label }}</p>
            <p
              class="mt-0.5 text-lg font-bold tabular-nums leading-none"
              style="
                background: linear-gradient(
                  135deg,
                  hsl(var(--primary)),
                  hsl(262 83% 62%)
                );
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
              "
            >
              {{ b.value }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <AnalysisOverview :items="overviewItems" class="mt-5" />

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
