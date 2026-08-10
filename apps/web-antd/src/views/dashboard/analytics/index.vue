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

import { Button, Empty, Result, Spin } from 'ant-design-vue';

import { getDashboardStats } from '#/api';
import { $t } from '#/locales';

import AnalyticsTrends from './analytics-trends.vue';

const overviewItems = ref<AnalysisOverviewItem[]>([]);
const statsError = ref(false);
const statsLoading = ref(true);

async function loadStats() {
  statsError.value = false;
  statsLoading.value = true;
  try {
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
  } catch (error) {
    console.error('Failed to load dashboard statistics:', error);
    overviewItems.value = [];
    statsError.value = true;
  } finally {
    statsLoading.value = false;
  }
}

onMounted(() => {
  void loadStats();
});
</script>

<template>
  <div class="p-5">
    <Spin :spinning="statsLoading">
      <AnalysisOverview
        v-if="overviewItems.length > 0"
        :items="overviewItems"
      />
      <Result
        v-else-if="statsError"
        status="error"
        :title="$t('page.dashboard.loadFailed')"
      >
        <template #extra>
          <Button type="primary" @click="loadStats">
            {{ $t('page.dashboard.retry') }}
          </Button>
        </template>
      </Result>
      <Empty v-else :description="$t('page.dashboard.noData')" />
    </Spin>

    <AnalysisChartCard :title="$t('page.dashboard.logTrend')" class="mt-5">
      <AnalyticsTrends />
    </AnalysisChartCard>
  </div>
</template>
