<script lang="ts" setup>
import type { AnalysisOverviewItem } from '@vben/common-ui';

import { onMounted, ref } from 'vue';

import { AnalysisChartCard, AnalysisOverview } from '@vben/common-ui';
import {
  SvgBellIcon,
  SvgCakeIcon,
  SvgCardIcon,
  SvgDownloadIcon,
} from '@vben/icons';

import { getDashboardStats } from '#/api';
import { $t } from '#/locales';

import AnalyticsTrends from './analytics-trends.vue';

const overviewItems = ref<AnalysisOverviewItem[]>([]);

async function loadStats() {
  const stats = await getDashboardStats();
  overviewItems.value = [
    {
      icon: SvgCardIcon,
      title: $t('system.user.title'),
      totalTitle: $t('page.dashboard.total'),
      totalValue: stats.userCount,
      value: stats.userCount,
    },
    {
      icon: SvgCakeIcon,
      title: $t('system.role.title'),
      totalTitle: $t('page.dashboard.total'),
      totalValue: stats.roleCount,
      value: stats.roleCount,
    },
    {
      icon: SvgDownloadIcon,
      title: $t('system.menu.title'),
      totalTitle: $t('page.dashboard.total'),
      totalValue: stats.menuCount,
      value: stats.menuCount,
    },
    {
      icon: SvgBellIcon,
      title: $t('system.onlineUser.title'),
      totalTitle: $t('page.dashboard.total'),
      totalValue: stats.onlineCount,
      value: stats.onlineCount,
    },
  ];
}

onMounted(loadStats);
</script>

<template>
  <div class="p-5">
    <AnalysisOverview :items="overviewItems" />
    <AnalysisChartCard :title="$t('page.dashboard.logTrend')" class="mt-5">
      <AnalyticsTrends />
    </AnalysisChartCard>
  </div>
</template>
