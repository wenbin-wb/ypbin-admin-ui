<script lang="ts" setup>
import type { SystemTrackingApi } from '#/api/system/tracking';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { TRACKING_EVENT_CATALOG, TrackingEventCodes } from '@vben/tracking';

import { Alert, Button, message, Progress, Select } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getTrackFunnel } from '#/api/system/tracking';
import { $t } from '#/locales';

/**
 * 漏斗步骤数下限/上限。
 *
 * 与后端 `TrackQueryParams`（MIN_FUNNEL_STEPS=2 / MAX_FUNNEL_STEPS=8）保持一致：
 * 单步不成漏斗，步骤再多命中率基本为 0。前端先挡住，避免把必然失败的请求发出去。
 */
const MIN_STEPS = 2;
const MAX_STEPS = 8;

/** 统计天数选项：与后端 funnel 的 days 参数一致（1..90，这里只暴露两个常用窗口） */
const DAY_OPTIONS = [7, 30] as const;

type FunnelDays = (typeof DAY_OPTIONS)[number];

/**
 * 默认步骤：页面浏览 → 接口调用结束。
 *
 * 事件码一律取 `@vben/tracking` 的常量（页面里禁止手写事件码字符串），
 * 并给出一组可直接查询的默认值——空白步骤只会让首屏必然校验失败。
 */
const steps = ref<string[]>([
  TrackingEventCodes.UI_PAGE_VIEW,
  TrackingEventCodes.API_REQUEST_END,
]);

const days = ref<FunnelDays>(DAY_OPTIONS[0]);

/** 事件序列被截断的会话数（后端 Long → 字符串），大于 0 时各步会话数只是下界 */
const truncatedCount = ref(0);

/**
 * 事件码下拉项。
 *
 * 与既有埋点页面同款：值为事件码，标签附带说明（只看到裸事件码是配不出漏斗的）。
 */
const stepOptions = Object.values(TRACKING_EVENT_CATALOG).map((event) => ({
  label: $t('tracking.events.eventCodeOption', [event.code, event.description]),
  value: event.code,
}));

/** 事件码说明：目录里查不到时回退显示事件码本身（后端已上线新事件但前端未重跑生成器） */
function eventDescription(eventCode: string): string {
  return TRACKING_EVENT_CATALOG[eventCode]?.description ?? eventCode;
}

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

/**
 * 漏斗表格行：后端字段 + 前端现算的百分比。
 *
 * 「相对首步」后端已算好（`conversionRate`）；「较上一步」后端不提供，
 * 由前端按相邻两步的 sessionCount 现算——不臆造接口字段。
 */
interface FunnelRow extends SystemTrackingApi.TrackFunnelStep {
  /** 相对首步转化率（百分数；后端返回 null 表示首步会话数为 0，不可计算） */
  fromFirstPercent: null | number;
  /** 较上一步转化率（百分数；首步、或上一步会话数为 0 时不可计算） */
  fromPreviousPercent: null | number;
}

function toFunnelRows(
  stepList: SystemTrackingApi.TrackFunnelStep[],
): FunnelRow[] {
  return stepList.map((step, index) => {
    const previousCount =
      index === 0 ? 0 : toCount(stepList[index - 1]?.sessionCount);
    return {
      ...step,
      fromFirstPercent:
        step.conversionRate === null
          ? null
          : toCount(step.conversionRate) * 100,
      fromPreviousPercent:
        index === 0 || previousCount <= 0
          ? null
          : (toCount(step.sessionCount) / previousCount) * 100,
    };
  });
}

/** 百分比文案：不可计算时明确写出来，不伪造成 0% */
function percentText(percent: null | number): string {
  return percent === null
    ? $t('tracking.funnel.unavailable')
    : `${percent.toFixed(2)}%`;
}

/** 进度条百分比：进度条只接受 0..100，文字仍显示真实值 */
function progressPercent(percent: null | number): number {
  return percent === null ? 0 : Math.min(100, Math.max(0, percent));
}

/** 步骤校验：不通过时给出提示并拒绝发请求（前端先挡，后端也会再校验一次） */
function validateSteps(): boolean {
  if (steps.value.length < MIN_STEPS || steps.value.length > MAX_STEPS) {
    message.warning($t('tracking.funnel.stepInvalid'));
    return false;
  }
  if (steps.value.some((eventCode) => !eventCode)) {
    message.warning($t('tracking.funnel.stepInvalid'));
    return false;
  }
  return true;
}

function addStep() {
  if (steps.value.length >= MAX_STEPS) {
    return;
  }
  steps.value.push('');
}

function removeStep(index: number) {
  if (steps.value.length <= MIN_STEPS) {
    return;
  }
  steps.value.splice(index, 1);
}

/** Select 清空时会给出 undefined（或非字符串），统一落成空串，保持 steps 是 string[] */
function onStepChange(index: number, value: unknown) {
  steps.value[index] = typeof value === 'string' ? value : '';
}

const [FunnelGrid, funnelGridApi] = useVbenVxeGrid<FunnelRow>({
  gridOptions: {
    columns: [
      {
        field: 'stepIndex',
        title: $t('tracking.funnel.stepColumn'),
        width: 90,
      },
      {
        field: 'eventCode',
        title: $t('tracking.funnel.eventCode'),
        minWidth: 260,
        // 两行内容（事件码 + 说明）不参与全局省略号截断
        showOverflow: false,
        slots: { default: 'eventCode' },
      },
      {
        field: 'sessionCount',
        title: $t('tracking.funnel.sessionCount'),
        width: 110,
        align: 'right',
      },
      {
        field: 'fromFirstPercent',
        title: $t('tracking.funnel.conversionFromFirst'),
        width: 220,
        // 进度条是块级元素，全局 showOverflow 会把它裁掉
        showOverflow: false,
        slots: { default: 'fromFirst' },
      },
      {
        field: 'fromPreviousPercent',
        title: $t('tracking.funnel.conversionFromPrevious'),
        width: 160,
        align: 'right',
        slots: { default: 'fromPrevious' },
      },
    ],
    emptyText: $t('tracking.funnel.noData'),
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          // 步骤非法时显式提示且不发请求：空 steps 会让后端直接抛业务错误
          if (!validateSteps()) {
            truncatedCount.value = 0;
            return { items: [], total: 0 };
          }
          try {
            const result = await getTrackFunnel(
              steps.value.join(','),
              days.value,
            );
            truncatedCount.value = toCount(result.truncatedSessionCount);
            const items = toFunnelRows(result.steps);
            return { items, total: items.length };
          } catch (error) {
            // 不静默降级：明确提示失败，表格空态配合错误提示一起暴露问题
            console.error('Failed to load tracking funnel:', error);
            message.error($t('tracking.funnel.loadFailed'));
            truncatedCount.value = 0;
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

/** 手动查询：先校验再走表格的代理查询（保证与刷新按钮同一条取数链路） */
async function runQuery() {
  if (!validateSteps()) {
    return;
  }
  await funnelGridApi.query();
}

async function onDaysChange(option: FunnelDays) {
  if (days.value === option) {
    return;
  }
  days.value = option;
  await runQuery();
}
</script>

<template>
  <Page
    auto-content-height
    :description="$t('tracking.funnel.description')"
    :title="$t('tracking.funnel.title')"
  >
    <div class="flex flex-col gap-4">
      <!-- 步骤编辑器 + 窗口选择 -->
      <div class="rounded-xl border border-border bg-card p-4">
        <h3 class="text-base font-semibold">
          {{ $t('tracking.funnel.stepsTitle') }}
        </h3>
        <p class="mb-3 mt-1 text-xs text-muted-foreground">
          {{ $t('tracking.funnel.stepsHint') }}
        </p>

        <div class="flex flex-col gap-2">
          <div
            v-for="(step, index) in steps"
            :key="index"
            class="flex items-center gap-2"
          >
            <span class="w-14 shrink-0 text-sm text-muted-foreground">
              {{ $t('tracking.funnel.step', [String(index + 1)]) }}
            </span>
            <Select
              :options="stepOptions"
              :placeholder="$t('tracking.funnel.stepPlaceholder')"
              :value="step"
              allow-clear
              class="flex-1"
              option-filter-prop="label"
              show-search
              @update:value="(value: unknown) => onStepChange(index, value)"
            />
            <Button
              :disabled="steps.length <= MIN_STEPS"
              danger
              @click="removeStep(index)"
            >
              {{ $t('tracking.funnel.removeStep') }}
            </Button>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Button :disabled="steps.length >= MAX_STEPS" @click="addStep">
            {{ $t('tracking.funnel.addStep') }}
          </Button>
          <span class="ml-2 text-sm text-muted-foreground">
            {{ $t('tracking.funnel.days') }}
          </span>
          <Button
            v-for="option in DAY_OPTIONS"
            :key="option"
            :type="days === option ? 'primary' : 'default'"
            @click="onDaysChange(option)"
          >
            {{
              option === 7
                ? $t('tracking.funnel.days7')
                : $t('tracking.funnel.days30')
            }}
          </Button>
          <Button class="ml-2" type="primary" @click="runQuery()">
            {{ $t('tracking.funnel.query') }}
          </Button>
        </div>
      </div>

      <!-- 「至少」前提：事件序列被截断时各步会话数只是下界 -->
      <Alert
        v-if="truncatedCount > 0"
        show-icon
        type="warning"
        :message="$t('tracking.funnel.truncated', [String(truncatedCount)])"
      />

      <!-- 漏斗结果 -->
      <div class="rounded-xl border border-border bg-card p-4">
        <h3 class="text-base font-semibold">
          {{ $t('tracking.funnel.resultTitle') }}
        </h3>
        <p class="mb-3 mt-1 text-xs text-muted-foreground">
          {{ $t('tracking.funnel.basis') }}
        </p>
        <FunnelGrid>
          <template #eventCode="{ row }">
            <div class="flex flex-col">
              <span>{{ row.eventCode }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {{ eventDescription(row.eventCode) }}
              </span>
            </div>
          </template>

          <template #fromFirst="{ row }">
            <div class="flex items-center gap-2 px-1">
              <Progress
                :percent="progressPercent(row.fromFirstPercent)"
                :show-info="false"
                class="flex-1"
                size="small"
              />
              <span class="w-20 text-right text-xs tabular-nums">
                {{ percentText(row.fromFirstPercent) }}
              </span>
            </div>
          </template>

          <template #fromPrevious="{ row }">
            <span class="text-xs tabular-nums">
              {{ percentText(row.fromPreviousPercent) }}
            </span>
          </template>
        </FunnelGrid>
      </div>
    </div>
  </Page>
</template>
