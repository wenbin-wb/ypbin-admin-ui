<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemTrackingApi } from '#/api/system/tracking';

import { onBeforeUnmount, ref, watch } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Download } from '@vben/icons';
import { TRACKING_EVENT_CATALOG } from '@vben/tracking';

import { Button, message, Segmented, Switch } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { exportTrackEvents, getTrackEventList } from '#/api/system/tracking';
import { $t } from '#/locales';
import { downloadBlobSafe } from '#/utils/file';

import { useColumns, useGridFormSchema } from './data';
import {
  clockTime,
  durationText,
  eventDomain,
  isFailed,
  MAX_HIGHLIGHTS,
  payloadHighlights,
  SLOW_DURATION_MS,
} from './meta';
import DetailDrawer from './modules/detail.vue';
import StreamView from './modules/stream.vue';
import SummaryBar from './modules/summary.vue';
import { usePageTitle } from './use-page-title';

const [Detail, drawerApi] = useVbenDrawer({ connectedComponent: DetailDrawer });

/** 页面地址 → 菜单标题（映射不到时回退原始地址） */
const { pageTitle } = usePageTitle();

/** 快捷时间范围 → 具体的 startTime/endTime（自定义时原样使用表单值） */
function resolveTimeRange(values: Recordable<any>): {
  endTime?: string;
  startTime?: string;
} {
  const range = values.quickRange as string | undefined;
  if (range === 'custom' || !range) {
    return { endTime: values.endTime, startTime: values.startTime };
  }
  const minutes = { '15m': 15, '1h': 60, '24h': 24 * 60, '7d': 7 * 24 * 60 }[
    range
  ];
  if (!minutes) {
    return { endTime: values.endTime, startTime: values.startTime };
  }
  const now = dayjs();
  return {
    endTime: now.format('YYYY-MM-DD HH:mm:ss'),
    startTime: now.subtract(minutes, 'minute').format('YYYY-MM-DD HH:mm:ss'),
  };
}

/** 表格与事件流共用同一份查询条件（两者数据源必须一致） */
type QueryFilters = Omit<
  SystemTrackingApi.TrackEventQuery,
  'page' | 'pageSize'
>;

function buildQuery(values: Recordable<any>): QueryFilters {
  const rest = { ...values };
  delete rest.page;
  delete rest.pageSize;
  delete rest.quickRange;
  return { ...rest, ...resolveTimeRange(values) };
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Recordable<any>) =>
          await getTrackEventList({
            ...buildQuery(formValues),
            page: page.currentPage,
            pageSize: page.pageSize,
          }),
      },
    },
    rowClassName: ({ row }) =>
      isFailed(row) ? 'cursor-pointer bg-destructive/5' : 'cursor-pointer',
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemTrackingApi.TrackEvent>,
});

/* ---------------- 视图切换：明细表 / 事件流 ---------------- */

const VIEW_TABLE = 'table';
const VIEW_STREAM = 'stream';
const viewMode = ref<string>(VIEW_TABLE);

const streamEvents = ref<SystemTrackingApi.TrackEvent[]>([]);
const streamLoading = ref(false);

async function loadStream() {
  streamLoading.value = true;
  try {
    const formValues = gridApi.formApi?.form?.values ?? {};
    const result = await getTrackEventList({
      ...buildQuery(formValues as Recordable<any>),
      page: 1,
      pageSize: 100,
    });
    streamEvents.value = result.items ?? [];
  } finally {
    streamLoading.value = false;
  }
}

watch(viewMode, (mode) => {
  if (mode === VIEW_STREAM) {
    void loadStream();
  }
});

/* ---------------- 自动刷新 ---------------- */

const AUTO_REFRESH_SECONDS = 30;
const autoRefresh = ref(false);
let timer: null | ReturnType<typeof setInterval> = null;

function refreshCurrentView() {
  if (viewMode.value === VIEW_STREAM) {
    void loadStream();
  } else {
    gridApi.query();
  }
}

watch(autoRefresh, (enabled) => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (enabled) {
    timer = setInterval(refreshCurrentView, AUTO_REFRESH_SECONDS * 1000);
  }
});

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});

/* ---------------- 概览联动 ---------------- */

function applyEventCode(eventCode: string) {
  viewMode.value = VIEW_TABLE;
  gridApi.formApi?.setFieldValue('eventCode', eventCode);
  gridApi.query();
}

/* ---------------- 单元格渲染 ---------------- */

/**
 * 事件码的说明文案。
 *
 * 目录里没有该码时（例如后端已上线新事件但前端未重跑生成器）如实标注，
 * 而不是回退成空串——"这个码没人认识"本身就是需要暴露的信号。
 */
function eventDescription(eventCode: string): string {
  return (
    TRACKING_EVENT_CATALOG[eventCode]?.description ??
    $t('tracking.events.unknownEventCode')
  );
}

function rowHighlights(row: SystemTrackingApi.TrackEvent) {
  return payloadHighlights(row.payload);
}

function payloadKeyCount(payload?: Record<string, unknown>): number {
  return Object.keys(payload ?? {}).length;
}

function isSlow(durationMs?: string): boolean {
  return Number(durationMs ?? 0) >= SLOW_DURATION_MS;
}

/* ---------------- 详情与操作 ---------------- */

function onCellClick({
  row,
  column,
}: {
  column?: { field?: string };
  row: SystemTrackingApi.TrackEvent;
}) {
  // 操作列有自己的按钮，点它不应再弹详情
  if (column?.field === 'action') {
    return;
  }
  onDetail(row);
}

function onDetail(row: SystemTrackingApi.TrackEvent) {
  drawerApi.setData(row);
  drawerApi.open();
}

async function copyTraceId(row: SystemTrackingApi.TrackEvent) {
  if (!row.traceId) {
    return;
  }
  try {
    await navigator.clipboard.writeText(row.traceId);
    message.success($t('common.copySuccess'));
  } catch (error) {
    console.error('Failed to copy traceId:', error);
    message.error($t('common.copyFailed'));
  }
}

const exportLoading = ref(false);

async function onExport() {
  exportLoading.value = true;
  try {
    // 导出沿用当前筛选条件（与列表同源），否则会导出与屏幕上不一致的数据
    const formValues = gridApi.formApi?.form?.values ?? {};
    const blob = await exportTrackEvents({
      ...buildQuery(formValues as Recordable<any>),
      page: 1,
      pageSize: 1,
    });
    const downloaded = await downloadBlobSafe(
      blob,
      $t('tracking.events.exportFileName'),
      $t('tracking.events.exportFailed'),
    );
    if (downloaded) {
      message.success($t('common.success'));
    }
  } catch (error) {
    console.error('Failed to export tracking events:', error);
    message.error($t('tracking.events.exportFailed'));
  } finally {
    exportLoading.value = false;
  }
}
</script>

<template>
  <Page auto-content-height>
    <Detail />
    <SummaryBar @apply-event-code="applyEventCode" />
    <Grid
      v-if="viewMode === VIEW_TABLE"
      :table-title="$t('tracking.events.title')"
      @cell-click="onCellClick"
    >
      <template #toolbar-tools>
        <Segmented
          v-model:value="viewMode"
          :options="[
            { label: $t('tracking.events.tableView'), value: 'table' },
            { label: $t('tracking.events.streamView'), value: 'stream' },
          ]"
          class="mr-2"
        />
        <div class="mr-2 flex items-center gap-2 text-sm">
          <Switch v-model:checked="autoRefresh" size="small" />
          <span class="text-muted-foreground">
            {{ $t('tracking.events.autoRefresh') }}
          </span>
        </div>
        <Button
          v-access:code="['system:track:export']"
          :loading="exportLoading"
          @click="onExport"
        >
          <Download class="mr-1 size-4" />
          {{ $t('tracking.events.export') }}
        </Button>
      </template>

      <template #receivedTime="{ row }">
        <span class="font-mono" :title="row.receivedTime">
          {{ clockTime(row.receivedTime) }}
        </span>
      </template>

      <template #eventCode="{ row }">
        <div class="flex items-start gap-2">
          <span
            class="mt-1.5 size-2 shrink-0 rounded-full"
            :class="eventDomain(row.eventCode).dotClass"
            :title="$t(eventDomain(row.eventCode).labelKey)"
          ></span>
          <div class="flex min-w-0 flex-col">
            <span class="truncate font-medium">{{ row.eventCode }}</span>
            <span class="truncate text-xs text-muted-foreground">
              {{ eventDescription(row.eventCode) }}
            </span>
          </div>
        </div>
      </template>

      <template #payloadHighlights="{ row }">
        <div class="flex flex-wrap items-center gap-1">
          <template v-if="rowHighlights(row).length > 0">
            <span
              v-for="item in rowHighlights(row)"
              :key="item.label"
              class="max-w-56 truncate rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-xs"
              :title="`${item.label}: ${item.value}`"
            >
              <span class="text-muted-foreground">{{ item.label }}</span>
              {{ item.value }}
            </span>
            <span
              v-if="payloadKeyCount(row.payload) > MAX_HIGHLIGHTS"
              class="text-xs text-muted-foreground"
              :title="$t('tracking.events.payloadMoreHint')"
            >
              +{{ payloadKeyCount(row.payload) - MAX_HIGHLIGHTS }}
            </span>
          </template>
          <span v-else class="text-muted-foreground">-</span>
        </div>
      </template>

      <template #pageUrl="{ row }">
        <span class="truncate" :title="row.pageUrl">
          {{ pageTitle(row.pageUrl) }}
        </span>
      </template>

      <template #durationMs="{ row }">
        <span
          class="font-mono"
          :class="isSlow(row.durationMs) ? 'text-amber-600' : ''"
        >
          {{ durationText(row.durationMs) }}
        </span>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.detail'),
              icon: 'lucide:eye',
              auth: 'system:track:list',
              onClick: () => onDetail(row),
            },
            {
              text: $t('tracking.events.copyTraceId'),
              icon: 'lucide:copy',
              auth: 'system:track:list',
              disabled: !row.traceId,
              onClick: () => copyTraceId(row),
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <StreamView
      v-else
      :events="streamEvents"
      :loading="streamLoading"
      @select="onDetail"
    />
  </Page>
</template>
