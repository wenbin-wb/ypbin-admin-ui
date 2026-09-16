<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemTrackingApi } from '#/api/system/tracking';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, message, Progress } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getTrackRetention } from '#/api/system/tracking';
import { $t } from '#/locales';

/**
 * 统计天数选项。
 *
 * 后端 `days` 支持 1..90；这里只暴露 7 / 30——D30 摘要只有 days ≥ 30 才会出现，
 * 而矩阵固定最长 7×7（`matrixDays = min(days, 7)`），两种窗口的矩阵宽度是一样的。
 */
const DAY_OPTIONS = [7, 30] as const;

type RetentionDays = (typeof DAY_OPTIONS)[number];

/** 矩阵列偏移日：与后端 `matrixDays` 上限一致（`TrackRetentionMatrixBuilder.MAX_MATRIX_DAYS = 7`） */
const MATRIX_OFFSETS = [0, 1, 2, 3, 4, 5, 6] as const;

const days = ref<RetentionDays>(DAY_OPTIONS[0]);

/** 矩阵网格边长（后端返回值；列数固定按 7 定义，偏差会在标题里如实暴露） */
const matrixDays = ref(0);

/** 摘要列（D1/D7/D30 中本次窗口内可观察的那些） */
const summary = ref<SystemTrackingApi.TrackRetentionSummary[]>([]);

/**
 * 计数换算成数字。
 *
 * 后端把 Long 序列化成十进制字符串，前端只在算比例时需要数值参与运算；
 * 计数规模远小于 2^53，转换是精确的（展示仍直接用原始字符串）。
 */
function toCount(value: null | string | undefined): number {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 留存率文案：该行基数为 0 时后端返回 null（不可计算），不伪造成 0% */
function rateText(rate: null | string | undefined): string {
  if (rate === null || rate === undefined || rate === '') {
    return $t('tracking.retention.unavailable');
  }
  return `${(toCount(rate) * 100).toFixed(2)}%`;
}

/** 进度条百分比：进度条只接受 0..100，文字仍显示真实值 */
function progressPercent(rate: null | string | undefined): number {
  if (rate === null || rate === undefined || rate === '') {
    return 0;
  }
  return Math.min(100, Math.max(0, toCount(rate) * 100));
}

/** 矩阵行 */
interface MatrixRow {
  cohortDate: string;
  cohortSize: string;
  cells: SystemTrackingApi.TrackRetentionCell[];
}

/**
 * 单元格文案「留存用户数 / 留存率」。
 *
 * 按 `dayOffset` 查找而不是按下标取：后端返回的 cells 顺序当前与 dayOffsets 一致，
 * 但接口给的是显式偏移日，按下标索引会在将来顺序变化时静默错列。
 */
function cellText(
  cells: SystemTrackingApi.TrackRetentionCell[],
  dayOffset: number,
): string {
  const cell = cells.find((item) => item.dayOffset === dayOffset);
  if (!cell) {
    return '-';
  }
  return $t('tracking.retention.cellBase', [
    cell.userCount,
    rateText(cell.retentionRate),
  ]);
}

const [RetentionGrid, retentionGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        field: 'cohortDate',
        title: $t('tracking.retention.cohortDate'),
        width: 140,
      },
      {
        field: 'cohortSize',
        title: $t('tracking.retention.cohortSize'),
        width: 120,
        align: 'right',
      },
      ...MATRIX_OFFSETS.map((dayOffset) => ({
        field: `d${dayOffset}`,
        title: $t('tracking.retention.dayColumn', [String(dayOffset)]),
        minWidth: 150,
        // 单元格是「人数 / 留存率」两段文案，不参与全局省略号截断
        showOverflow: false,
        formatter: ({ row }: { row: MatrixRow }) =>
          cellText(row.cells, dayOffset),
      })),
    ],
    emptyText: $t('tracking.retention.noData'),
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          try {
            const result = await getTrackRetention(days.value);
            matrixDays.value = result.matrixDays;
            summary.value = result.summary;
            return { items: result.rows, total: result.rows.length };
          } catch (error) {
            // 不静默降级：明确提示失败，表格空态配合错误提示一起暴露问题
            console.error('Failed to load tracking retention:', error);
            message.error($t('tracking.retention.loadFailed'));
            matrixDays.value = 0;
            summary.value = [];
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
  } as VxeTableGridOptions<MatrixRow>,
});

async function onDaysChange(option: RetentionDays) {
  if (days.value === option) {
    return;
  }
  days.value = option;
  await retentionGridApi.query();
}
</script>

<template>
  <Page
    auto-content-height
    :description="$t('tracking.retention.description')"
    :title="$t('tracking.retention.title')"
  >
    <div class="flex flex-col gap-4">
      <!-- 窗口切换 -->
      <div class="rounded-xl border border-border bg-card p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-muted-foreground">
            {{ $t('tracking.retention.days') }}
          </span>
          <Button
            v-for="option in DAY_OPTIONS"
            :key="option"
            :type="days === option ? 'primary' : 'default'"
            @click="onDaysChange(option)"
          >
            {{
              option === 7
                ? $t('tracking.retention.days7')
                : $t('tracking.retention.days30')
            }}
          </Button>
        </div>
      </div>

      <!-- 口径说明：窗口最大目标日、D30 数据前提、只覆盖登录用户 -->
      <Alert show-icon type="info">
        <template #message>
          {{ $t('tracking.retention.noteTitle') }}
        </template>
        <template #description>
          <ul class="list-disc pl-4 text-xs">
            <li>{{ $t('tracking.retention.noteWindow') }}</li>
            <li>{{ $t('tracking.retention.noteD30') }}</li>
            <li>{{ $t('tracking.retention.noteLoginOnly') }}</li>
          </ul>
        </template>
      </Alert>

      <!-- 摘要列 D1/D7/D30 -->
      <div class="rounded-xl border border-border bg-card p-4">
        <h3 class="text-base font-semibold">
          {{ $t('tracking.retention.summaryTitle') }}
        </h3>
        <p class="mb-3 mt-1 text-xs text-muted-foreground">
          {{ $t('tracking.retention.summaryHint') }}
        </p>
        <div
          v-if="summary.length > 0"
          class="grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          <div
            v-for="item in summary"
            :key="item.dayOffset"
            class="rounded-xl border border-border bg-card p-4"
          >
            <p class="text-sm text-muted-foreground">
              {{ $t('tracking.retention.dayColumn', [String(item.dayOffset)]) }}
            </p>
            <p class="mt-2 text-2xl font-bold tabular-nums leading-none">
              {{ rateText(item.retentionRate) }}
            </p>
            <Progress
              :percent="progressPercent(item.retentionRate)"
              :show-info="false"
              class="mt-2"
              size="small"
            />
            <p class="mt-2 text-xs text-muted-foreground tabular-nums">
              {{
                $t('tracking.retention.summaryBase', [
                  item.userCount,
                  item.cohortSize,
                ])
              }}
            </p>
          </div>
        </div>
        <p v-else class="text-sm text-muted-foreground">
          {{ $t('tracking.retention.noData') }}
        </p>
      </div>

      <!-- 留存矩阵 -->
      <div class="rounded-xl border border-border bg-card p-4">
        <h3 class="text-base font-semibold">
          {{ $t('tracking.retention.matrixTitle') }}
        </h3>
        <p
          v-if="matrixDays > 0"
          class="mb-3 mt-1 text-xs text-muted-foreground"
        >
          {{
            $t('tracking.retention.matrixLayout', [
              String(matrixDays),
              String(matrixDays),
            ])
          }}
        </p>
        <RetentionGrid />
      </div>
    </div>
  </Page>
</template>
