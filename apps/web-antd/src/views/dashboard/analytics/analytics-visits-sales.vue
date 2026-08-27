<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import { onMounted, ref } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import { $t } from '#/locales';

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

onMounted(() => {
  renderEcharts({
    series: [
      {
        animationDelay() {
          return Math.random() * 400;
        },
        animationEasing: 'exponentialInOut',
        animationType: 'scale',
        center: ['50%', '50%'],
        color: ['#5b8ff9', '#818cf8', '#22d3ee', '#67e0a3'],
        data: [
          { name: $t('page.dashboard.outsourcing'), value: 500 },
          { name: $t('page.dashboard.custom'), value: 310 },
          { name: $t('page.dashboard.support'), value: 274 },
          { name: $t('page.dashboard.remote'), value: 400 },
        ].toSorted((a, b) => {
          return a.value - b.value;
        }),
        itemStyle: {
          borderRadius: 4,
        },
        label: {
          color: 'inherit',
          fontSize: 11,
        },
        name: $t('page.dashboard.businessRatio'),
        radius: '80%',
        roseType: 'radius',
        type: 'pie',
      },
    ],

    tooltip: {
      trigger: 'item',
    },
  });
});
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>
