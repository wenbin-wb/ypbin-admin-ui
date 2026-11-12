<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemTrackingApi } from '#/api/system/tracking';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { TRACKING_EVENT_CATALOG } from '@vben/tracking';

import { Button, Input, message, Popover, Select } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { exportTrackEvents, getTrackEventList } from '#/api/system/tracking';
import { $t } from '#/locales';
import { downloadBlobSafe } from '#/utils/file';

import { copyToClipboard } from './clipboard';
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
import ViewControls from './modules/view-controls.vue';
import { usePageTitle } from './use-page-title';
import {
  createSavedView,
  loadSavedViews,
  MAX_SAVED_VIEWS,
  persistSavedViews,
} from './use-saved-views';

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

/**
 * 筛选表单独立于网格：视图切到「事件流」时网格会被卸载，
 * 把表单放在网格内部会导致事件流视图下无法调整筛选条件。
 */
const [FilterForm, filterFormApi] = useVbenForm({
  layout: 'horizontal',
  schema: useGridFormSchema(),
  // 用表单自带的动作栏（重置/查询/展开收起），与系统其它列表页的搜索区一致；
  // 折叠按钮就渲染在动作栏里，关掉默认动作等于同时关掉了折叠入口。
  showDefaultActions: true,
  showCollapseButton: true,
  collapsed: true,
  collapsedRows: 1,
  submitButtonOptions: { content: $t('common.query') },
  handleSubmit: async () => {
    await onSearch();
  },
  handleReset: async () => {
    await filterFormApi.reset();
    await onSearch();
  },
  wrapperClass: 'grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3',
});

/** 已提交的筛选条件：表格与事件流共用，避免两者看到不同的数据 */
const activeFilters = ref<Recordable<any>>({ quickRange: '24h' });

async function onSearch() {
  activeFilters.value = await filterFormApi.getValues();
  refreshCurrentView();
}

/* ---------------- 常用筛选视图（localStorage） ---------------- */

const savedViews = ref(loadSavedViews());
const selectedViewId = ref<string>();
const savePopoverOpen = ref(false);
const viewName = ref('');

const savedViewOptions = computed(() =>
  savedViews.value.map((view) => ({ label: view.name, value: view.id })),
);

async function applySavedView(value?: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return;
  }
  const viewId = String(value);
  const view = savedViews.value.find((item) => item.id === viewId);
  if (!view) {
    return;
  }
  await filterFormApi.setValues(view.filters);
  await onSearch();
}

async function onSaveView() {
  const name = viewName.value.trim();
  if (!name) {
    message.warning($t('tracking.events.viewNameRequired'));
    return;
  }
  const values = (await filterFormApi.getValues()) as Record<string, unknown>;
  const existing = savedViews.value.find((item) => item.name === name);
  if (!existing && savedViews.value.length >= MAX_SAVED_VIEWS) {
    message.warning($t('tracking.events.viewLimitReached', [MAX_SAVED_VIEWS]));
    return;
  }
  if (existing) {
    // 同名即覆盖：用户重复保存同名视图时，期望的是更新而不是出现两个同名项
    existing.filters = values;
    selectedViewId.value = existing.id;
  } else {
    const view = createSavedView(name, values);
    savedViews.value = [...savedViews.value, view];
    selectedViewId.value = view.id;
  }
  persistSavedViews(savedViews.value);
  savePopoverOpen.value = false;
  viewName.value = '';
  message.success($t('tracking.events.viewSaved'));
}

function onDeleteView() {
  if (!selectedViewId.value) {
    return;
  }
  savedViews.value = savedViews.value.filter(
    (item) => item.id !== selectedViewId.value,
  );
  persistSavedViews(savedViews.value);
  selectedViewId.value = undefined;
  message.success($t('tracking.events.viewDeleted'));
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }) =>
          await getTrackEventList({
            ...buildQuery(activeFilters.value),
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
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemTrackingApi.TrackEvent>,
  gridEvents: {
    cellClick: onCellClick,
  },
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
    const result = await getTrackEventList({
      ...buildQuery(activeFilters.value),
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
    await copyToClipboard(row.traceId);
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
    const blob = await exportTrackEvents({
      ...buildQuery(activeFilters.value),
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
    <div class="flex h-full min-h-0 flex-col">
      <SummaryBar class="shrink-0" />

      <div class="mb-3 shrink-0 rounded-lg border bg-card p-4">
        <div class="mb-3 flex flex-wrap items-center justify-end gap-2">
          <Select
            v-model:value="selectedViewId"
            :options="savedViewOptions"
            :placeholder="$t('tracking.events.savedViewsPlaceholder')"
            allow-clear
            class="w-56"
            @change="applySavedView"
          />
          <Popover
            v-model:open="savePopoverOpen"
            placement="bottomRight"
            trigger="click"
          >
            <template #content>
              <div class="flex w-64 flex-col gap-2">
                <Input
                  v-model:value="viewName"
                  :placeholder="$t('tracking.events.viewNamePlaceholder')"
                  :maxlength="30"
                  @press-enter="onSaveView"
                />
                <div class="flex justify-end gap-2">
                  <Button size="small" @click="savePopoverOpen = false">
                    {{ $t('common.cancel') }}
                  </Button>
                  <Button size="small" type="primary" @click="onSaveView">
                    {{ $t('tracking.events.saveView') }}
                  </Button>
                </div>
              </div>
            </template>
            <Button size="small">
              {{ $t('tracking.events.saveCurrentView') }}
            </Button>
          </Popover>
          <Button
            v-if="selectedViewId"
            danger
            size="small"
            @click="onDeleteView"
          >
            {{ $t('tracking.events.deleteView') }}
          </Button>
        </div>
        <FilterForm />
      </div>

      <div v-if="viewMode === VIEW_TABLE" class="min-h-0 flex-1">
        <Grid :table-title="$t('tracking.events.title')">
          <template #toolbar-tools>
            <ViewControls
              v-model:auto-refresh="autoRefresh"
              v-model:view-mode="viewMode"
              :export-loading="exportLoading"
              @export="onExport"
            />
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
              ]"
              :dropdown-actions="[
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
      </div>

      <div v-else class="flex min-h-0 flex-1 flex-col">
        <div
          class="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2"
        >
          <span class="text-base font-medium">
            {{ $t('tracking.events.title') }}
          </span>
          <ViewControls
            v-model:auto-refresh="autoRefresh"
            v-model:view-mode="viewMode"
            :export-loading="exportLoading"
            @export="onExport"
          />
        </div>
        <div class="min-h-0 flex-1 overflow-auto">
          <StreamView
            :events="streamEvents"
            :loading="streamLoading"
            @select="onDetail"
          />
        </div>
      </div>
    </div>
  </Page>
</template>
