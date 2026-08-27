<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { $t } from '#/locales';

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

onMounted(() => {
  renderEcharts({
    legend: {
      bottom: 0,
      data: [$t('page.dashboard.visitName'), $t('page.dashboard.trendName')],
    },
    radar: {
      indicator: [
        {
          name: $t('page.dashboard.web'),
        },
        {
          name: $t('page.dashboard.mobile'),
        },
        {
          name: 'Ipad',
        },
        {
          name: $t('page.dashboard.client'),
        },
        {
          name: $t('page.dashboard.thirdParty'),
        },
        {
          name: $t('page.dashboard.other'),
        },
      ],
      radius: '60%',
      splitNumber: 8,
    },
    series: [
      {
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            x2: 1,
            y: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(129,140,248,0.5)' },
              { offset: 1, color: 'rgba(129,140,248,0.05)' },
            ],
          },
          opacity: 1,
          shadowBlur: 12,
          shadowColor: 'rgba(129,140,248,0.4)',
          shadowOffsetX: 0,
          shadowOffsetY: 6,
        },
        data: [
          {
            itemStyle: {
              color: '#818cf8',
            },
            name: $t('page.dashboard.visitName'),
            value: [90, 50, 86, 40, 50, 20],
          },
          {
            itemStyle: {
              color: '#22d3ee',
            },
            name: $t('page.dashboard.trendName'),
            value: [70, 75, 70, 76, 20, 85],
          },
        ],
        itemStyle: {
          borderRadius: 10,
          borderWidth: 2,
        },
        symbolSize: 0,
        type: 'radar',
      },
    ],
    tooltip: {},
  });
});
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
