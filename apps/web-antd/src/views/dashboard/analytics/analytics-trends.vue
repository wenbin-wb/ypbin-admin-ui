<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { nextTick, onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { Button, Empty, Result, Spin } from 'ant-design-vue';

import { getLogTrend } from '#/api';
import { $t } from '#/locales';

const chartRef = ref<EchartsUIType>();
const trendEmpty = ref(false);
const trendError = ref(false);
const trendLoading = ref(true);
const { renderEcharts } = useEcharts(chartRef);

async function loadTrend() {
  trendEmpty.value = false;
  trendError.value = false;
  trendLoading.value = true;
  try {
    const trend = await getLogTrend(14);
    if (trend.length === 0) {
      trendEmpty.value = true;
      return;
    }

    await nextTick();
    renderEcharts({
      grid: {
        bottom: 0,
        containLabel: true,
        left: '1%',
        right: '1%',
        top: '2%',
      },
      series: [
        {
          areaStyle: {},
          data: trend.map((item) => item.count),
          itemStyle: {
            color: '#5ab1ef',
          },
          smooth: true,
          type: 'line',
        },
      ],
      tooltip: {
        axisPointer: {
          lineStyle: {
            color: '#019680',
            width: 1,
          },
        },
        trigger: 'axis',
      },
      xAxis: {
        axisTick: {
          show: false,
        },
        boundaryGap: false,
        data: trend.map((item) => item.date),
        splitLine: {
          lineStyle: {
            type: 'solid',
            width: 1,
          },
          show: true,
        },
        type: 'category',
      },
      yAxis: [
        {
          axisTick: {
            show: false,
          },
          minInterval: 1,
          splitArea: {
            show: true,
          },
          type: 'value',
        },
      ],
    });
  } catch (error) {
    console.error('Failed to load dashboard log trend:', error);
    trendError.value = true;
  } finally {
    trendLoading.value = false;
  }
}

onMounted(() => {
  void loadTrend();
});
</script>

<template>
  <Spin :spinning="trendLoading">
    <Result
      v-if="trendError"
      status="error"
      :title="$t('page.dashboard.loadFailed')"
    >
      <template #extra>
        <Button type="primary" @click="loadTrend">
          {{ $t('page.dashboard.retry') }}
        </Button>
      </template>
    </Result>
    <Empty v-else-if="trendEmpty" :description="$t('page.dashboard.noData')" />
    <EchartsUI v-else ref="chartRef" />
  </Spin>
</template>
