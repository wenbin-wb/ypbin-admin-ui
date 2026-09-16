<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import type { SystemTrackingApi } from '#/api/system/tracking';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { TRACKING_EVENT_CATALOG } from '@vben/tracking';

import { Button, message, Progress } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getTrackAppDistribution,
  getTrackOverview,
  getTrackTopEvents,
  getTrackTrend,
} from '#/api/system/tracking';
import { $t } from '#/locales';

/**
 * 分析页的统计窗口。
 *
 * 概览、Top 事件与应用分布**固定 7 天**（与后端 `weekXxx` 字段口径一致），
 * 只有趋势图允许在 7 / 30 天之间切换——两者窗口不同时，页面上分别标注天数，
 * 避免"占比的分母到底是几天"这类歧义。
 */
const TOP_DAYS = 7;
const TOP_LIMIT = 10;
const TREND_DAY_OPTIONS = [7, 30] as const;

type TrendDays = (typeof TREND_DAY_OPTIONS)[number];

const overview = ref<SystemTrackingApi.TrackOverview>();
const trendDays = ref<TrendDays>(TREND_DAY_OPTIONS[0]);
const trendPoints = ref<SystemTrackingApi.TrackTrend[]>([]);

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

/**
 * 计数换算成数字。
 *
 * 后端把 Long 序列化成十进制字符串，前端只在**算比例**时需要数值参与运算；
 * 计数规模远小于 2^53，转换是精确的（展示仍直接用原始字符串，不做精度假设）。
 */
function toCount(value: string | undefined): number {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

const weekEventTotal = computed(() => toCount(overview.value?.weekEvents));

/** 失败率：分母为 0 时不给数字——0/0 显示成 0% 会掩盖"根本没数据" */
const failureRateText = computed(() => {
  const total = weekEventTotal.value;
  if (!overview.value || total <= 0) {
    return $t('tracking.analysis.failureRateUnavailable');
  }
  const rate = (toCount(overview.value.weekFailures) / total) * 100;
  return $t('tracking.analysis.failureRate', [`${rate.toFixed(2)}%`]);
});

interface OverviewCard {
  key: string;
  label: string;
  value: string;
  /** 补充说明：只有失败数卡片带失败率，其余为空串（保持字段同构，模板取值不需要可选判断） */
  hint: string;
}

const overviewCards = computed<OverviewCard[]>(() => [
  {
    key: 'total',
    label: $t('tracking.analysis.totalEvents'),
    value: overview.value?.totalEvents ?? '-',
    hint: '',
  },
  {
    key: 'today',
    label: $t('tracking.analysis.todayEvents'),
    value: overview.value?.todayEvents ?? '-',
    hint: '',
  },
  {
    key: 'week',
    label: $t('tracking.analysis.weekEvents'),
    value: overview.value?.weekEvents ?? '-',
    hint: '',
  },
  {
    key: 'users',
    label: $t('tracking.analysis.weekUsers'),
    value: overview.value?.weekUsers ?? '-',
    hint: '',
  },
  {
    key: 'failures',
    label: $t('tracking.analysis.weekFailures'),
    value: overview.value?.weekFailures ?? '-',
    hint: failureRateText.value,
  },
]);

/** 该事件占近 7 天事件总数的百分比；分母为 0 时返回 null（展示为 '-'） */
function ratioValue(count: string): null | number {
  if (weekEventTotal.value <= 0) {
    return null;
  }
  return (toCount(count) / weekEventTotal.value) * 100;
}

function ratioText(count: string): string {
  const ratio = ratioValue(count);
  return ratio === null ? '-' : `${ratio.toFixed(2)}%`;
}

/**
 * 进度条百分比。
 *
 * 进度条只接受 0..100，这里单独夹取；文字仍显示真实值——
 * 一旦出现 >100%（Top 事件窗口与概览窗口口径不一致的信号），
 * 数字会如实暴露，而不是被进度条一起"修掉"。
 */
function ratioPercent(count: string): number {
  const ratio = ratioValue(count);
  return ratio === null ? 0 : Math.min(100, Math.max(0, ratio));
}

/**
 * 事件码的说明文案。
 *
 * 目录里查不到该码时（后端已上线新事件但前端未重跑生成器）回退显示事件码本身，
 * 不报错也不显示空串——这一行始终有内容，排查时至少知道码是什么。
 */
function eventDescription(eventCode: string): string {
  return TRACKING_EVENT_CATALOG[eventCode]?.description ?? eventCode;
}

/**
 * 图表配置类型取自 `renderEcharts` 的入参。
 *
 * 不额外 `import type { EChartsOption } from 'echarts'`：echarts 不是本应用的直接依赖
 * （只经 `@vben/plugins` 传递进来），直接依赖它会在 pnpm 严格依赖下解析失败。
 */
type TrendChartOption = Parameters<typeof renderEcharts>[0];

function buildTrendOption(
  points: SystemTrackingApi.TrackTrend[],
): TrendChartOption {
  return {
    grid: { bottom: 8, containLabel: true, left: 8, right: 16, top: 24 },
    series: [
      {
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            x2: 0,
            y: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0,102,245,0.45)' },
              { offset: 1, color: 'rgba(0,102,245,0.02)' },
            ],
          },
        },
        data: points.map((point) => toCount(point.count)),
        itemStyle: { color: '#0066f5' },
        lineStyle: { color: '#0066f5', width: 2.5 },
        name: $t('tracking.analysis.trendSeries'),
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        type: 'line',
      },
    ],
    tooltip: { trigger: 'axis' },
    xAxis: {
      axisLabel: { hideOverlap: true },
      axisTick: { show: false },
      boundaryGap: false,
      data: points.map((point) => point.date),
      splitLine: { show: false },
      type: 'category',
    },
    yAxis: {
      axisTick: { show: false },
      minInterval: 1,
      splitNumber: 4,
      type: 'value',
    },
  };
}

/** 趋势请求序号：连续切换天数时丢弃过期响应，避免慢请求覆盖新结果 */
let trendRequestSeq = 0;

async function loadTrend() {
  const seq = ++trendRequestSeq;
  try {
    const points = await getTrackTrend(trendDays.value);
    if (seq !== trendRequestSeq) {
      return;
    }
    trendPoints.value = points;
    if (points.length > 0) {
      await renderEcharts(buildTrendOption(points));
    }
  } catch (error) {
    console.error('Failed to load tracking trend:', error);
    message.error($t('tracking.analysis.loadFailed'));
  }
}

async function onTrendDaysChange(days: TrendDays) {
  if (trendDays.value === days) {
    return;
  }
  trendDays.value = days;
  await loadTrend();
}

async function loadOverview() {
  try {
    overview.value = await getTrackOverview();
  } catch (error) {
    console.error('Failed to load tracking overview:', error);
    message.error($t('tracking.analysis.loadFailed'));
  }
}

const [TopGrid] = useVbenVxeGrid<SystemTrackingApi.TrackTopEvent>({
  gridOptions: {
    columns: [
      {
        field: 'eventCode',
        title: $t('tracking.analysis.eventCode'),
        minWidth: 240,
        // 两行内容（事件码 + 说明）不参与全局省略号截断
        showOverflow: false,
        slots: { default: 'eventCode' },
      },
      {
        field: 'count',
        title: $t('tracking.analysis.count'),
        width: 100,
        align: 'right',
      },
      {
        field: 'ratio',
        title: $t('tracking.analysis.ratio'),
        width: 200,
        // 进度条是块级元素，全局 showOverflow 会把它裁掉
        showOverflow: false,
        slots: { default: 'ratio' },
      },
    ],
    emptyText: $t('tracking.analysis.noData'),
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          try {
            const items = await getTrackTopEvents(TOP_DAYS, TOP_LIMIT);
            return { items, total: items.length };
          } catch (error) {
            // 不静默降级：明确提示失败，表格空态配合错误提示一起暴露问题
            console.error('Failed to load tracking top events:', error);
            message.error($t('tracking.analysis.loadFailed'));
            return { items: [], total: 0 };
          }
        },
      },
    },
    rowConfig: { keyField: 'eventCode' },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: true,
      search: false,
      zoom: false,
    },
  },
});

const [AppGrid] = useVbenVxeGrid<SystemTrackingApi.TrackAppCount>({
  gridOptions: {
    columns: [
      {
        field: 'appId',
        title: $t('tracking.events.appId'),
        minWidth: 200,
        // appId 可能为空（上报方未带应用标识）→ 展示"未设置"而不是空白单元格
        formatter: ({ cellValue }: { cellValue?: string }) =>
          cellValue || $t('tracking.analysis.appIdUnset'),
      },
      {
        field: 'count',
        title: $t('tracking.analysis.count'),
        width: 100,
        align: 'right',
      },
    ],
    // 不用 appId 做行主键：空值行（未带应用标识）会与非空行共享键，改用表格自生成的键
    emptyText: $t('tracking.analysis.noData'),
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          try {
            const items = await getTrackAppDistribution(TOP_DAYS);
            return { items, total: items.length };
          } catch (error) {
            console.error('Failed to load tracking app distribution:', error);
            message.error($t('tracking.analysis.loadFailed'));
            return { items: [], total: 0 };
          }
        },
      },
    },
    toolbarConfig: {
      custom: false,
      export: false,
      refresh: true,
      search: false,
      zoom: false,
    },
  },
});

onMounted(async () => {
  await Promise.all([loadOverview(), loadTrend()]);
});
</script>

<template>
  <Page
    auto-content-height
    :description="$t('tracking.analysis.description')"
    :title="$t('tracking.analysis.title')"
  >
    <div class="flex flex-col gap-4">
      <!-- 概览卡：5 个关键计数，失败数附失败率 -->
      <div class="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <div
          v-for="card in overviewCards"
          :key="card.key"
          class="rounded-xl border border-border bg-card p-4"
        >
          <p class="text-sm text-muted-foreground">{{ card.label }}</p>
          <p class="mt-2 text-2xl font-bold tabular-nums leading-none">
            {{ card.value }}
          </p>
          <p
            v-if="card.hint"
            class="mt-2 text-xs text-muted-foreground tabular-nums"
          >
            {{ card.hint }}
          </p>
        </div>
      </div>

      <!-- 趋势折线图：7 / 30 天切换 -->
      <div class="rounded-xl border border-border bg-card p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-base font-semibold">
            {{ $t('tracking.analysis.trendTitle') }}
          </h3>
          <div class="flex gap-2">
            <Button
              v-for="days in TREND_DAY_OPTIONS"
              :key="days"
              :type="trendDays === days ? 'primary' : 'default'"
              @click="onTrendDaysChange(days)"
            >
              {{
                days === 7
                  ? $t('tracking.analysis.trendDays7')
                  : $t('tracking.analysis.trendDays30')
              }}
            </Button>
          </div>
        </div>
        <EchartsUI
          v-if="trendPoints.length > 0"
          ref="chartRef"
          height="320px"
        />
        <div
          v-else
          class="flex h-[320px] items-center justify-center text-sm text-muted-foreground"
        >
          {{ $t('tracking.analysis.noData') }}
        </div>
      </div>

      <!-- Top 事件 -->
      <div class="rounded-xl border border-border bg-card p-4">
        <h3 class="text-base font-semibold">
          {{ $t('tracking.analysis.topTitle') }}
        </h3>
        <p class="mb-3 mt-1 text-xs text-muted-foreground">
          {{ $t('tracking.analysis.ratioBasis') }}
        </p>
        <TopGrid>
          <template #eventCode="{ row }">
            <div class="flex flex-col">
              <span>{{ row.eventCode }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ eventDescription(row.eventCode) }}
              </span>
            </div>
          </template>

          <template #ratio="{ row }">
            <div class="flex items-center gap-2 px-1">
              <Progress
                :percent="ratioPercent(row.count)"
                :show-info="false"
                class="flex-1"
                size="small"
              />
              <span class="w-16 text-right text-xs tabular-nums">
                {{ ratioText(row.count) }}
              </span>
            </div>
          </template>
        </TopGrid>
      </div>

      <!-- 应用分布 -->
      <div class="rounded-xl border border-border bg-card p-4">
        <h3 class="mb-3 text-base font-semibold">
          {{ $t('tracking.analysis.appTitle') }}
        </h3>
        <AppGrid />
      </div>
    </div>
  </Page>
</template>
