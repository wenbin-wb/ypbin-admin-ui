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
      bottom: '2%',
      left: 'center',
    },
    series: [
      {
        animationDelay() {
          return Math.random() * 100;
        },
        animationEasing: 'exponentialInOut',
        animationType: 'scale',
        avoidLabelOverlap: false,
        color: ['#5b8ff9', '#818cf8', '#22d3ee', '#67e0a3'],
        data: [
          { name: $t('page.dashboard.searchEngine'), value: 1048 },
          { name: $t('page.dashboard.directAccess'), value: 735 },
          { name: $t('page.dashboard.email'), value: 580 },
          { name: $t('page.dashboard.affiliate'), value: 484 },
        ],
        emphasis: {
          label: {
            fontSize: '12',
            fontWeight: 'bold',
            show: true,
          },
          scaleSize: 8,
        },
        itemStyle: {
          borderColor: 'transparent',
          borderRadius: 6,
          borderWidth: 2,
        },
        label: {
          position: 'center',
          show: false,
        },
        labelLine: {
          show: false,
        },
        name: $t('page.dashboard.visitSource'),
        radius: ['42%', '66%'],
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
