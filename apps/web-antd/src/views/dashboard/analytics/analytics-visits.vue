<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { $t } from '#/locales';

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

onMounted(() => {
  renderEcharts({
    grid: {
      bottom: 0,
      containLabel: true,
      left: '1%',
      right: '1%',
      top: '4%',
    },
    series: [
      {
        barMaxWidth: 32,
        data: [
          3000, 2000, 3333, 5000, 3200, 4200, 3200, 2100, 3000, 5100, 6000,
          3200, 4800,
        ],
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            x2: 0,
            y: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#0066f5' },
              { offset: 1, color: 'rgba(0,102,245,0.25)' },
            ],
          },
        },
        type: 'bar',
      },
    ],
    tooltip: {
      axisPointer: {
        lineStyle: {
          color: '#0066f5',
          width: 1,
        },
      },
      trigger: 'axis',
    },
    xAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      data: Array.from({ length: 12 }).map((_item, index) =>
        $t('page.dashboard.month', [index + 1]),
      ),
      type: 'category',
    },
    yAxis: {
      axisLine: { show: false },
      max: 8000,
      splitLine: {
        lineStyle: { type: 'dashed' },
      },
      splitNumber: 4,
      type: 'value',
    },
  });
});
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
