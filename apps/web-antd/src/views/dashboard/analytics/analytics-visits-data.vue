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
          opacity: 1,
          shadowBlur: 0,
          shadowColor: 'rgba(0,0,0,.2)',
          shadowOffsetX: 0,
          shadowOffsetY: 10,
        },
        data: [
          {
            itemStyle: {
              color: '#b6a2de',
            },
            name: $t('page.dashboard.visitName'),
            value: [90, 50, 86, 40, 50, 20],
          },
          {
            itemStyle: {
              color: '#5ab1ef',
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
