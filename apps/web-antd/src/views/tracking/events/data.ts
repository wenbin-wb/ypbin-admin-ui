import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { TRACKING_EVENT_CATALOG } from '@vben/tracking';

import { $t } from '#/locales';

/**
 * 空值占位。
 *
 * IP/referrer 这类字段在上报方缺失时是空串，直接留空会让使用者分不清
 * 「没有这一列的数据」和「这一行恰好为空」，故统一显示为短横线。
 */
const EMPTY_TEXT = '-';

/** 快捷时间范围选项值（与后端 startTime/endTime 解耦，由列表换算成具体时间） */
export const QUICK_RANGES = ['15m', '1h', '24h', '7d', 'custom'] as const;

export type QuickRange = (typeof QUICK_RANGES)[number];

/** 结果标签选项：与后端 success 取值一致（1 成功、0 失败） */
function resultOptions() {
  return [
    { color: 'success', label: $t('tracking.events.success'), value: 1 },
    { color: 'error', label: $t('tracking.events.fail'), value: 0 },
  ];
}

/**
 * 事件码下拉项。
 *
 * 数据来自 `@vben/tracking` 的事件目录（不新增后端字典接口）：值为事件码，
 * 标签附带中文说明——筛选时只看到裸事件码是排查不动的。
 */
function eventCodeOptions() {
  return Object.values(TRACKING_EVENT_CATALOG)
    .map((event) => ({
      label: $t('tracking.events.eventCodeOption', [
        event.code,
        event.description,
      ]),
      value: event.code,
    }))
    .toSorted((a, b) => a.value.localeCompare(b.value));
}

export function useColumns(): VxeTableGridColumns {
  return [
    {
      field: 'receivedTime',
      title: $t('tracking.events.receivedTime'),
      width: 110,
      slots: { default: 'receivedTime' },
    },
    {
      field: 'eventCode',
      title: $t('tracking.events.eventCode'),
      minWidth: 220,
      slots: { default: 'eventCode' },
    },
    {
      field: 'payload',
      title: $t('tracking.events.payloadHighlights'),
      minWidth: 260,
      slots: { default: 'payloadHighlights' },
    },
    {
      field: 'userId',
      title: $t('tracking.events.user'),
      width: 140,
      // 后端 `@RefText("user")` 派生字段优先：有展示名时用展示名，缺失时回退裸 ID；
      // 匿名事件展示 anonId，至少还能按人串起来
      formatter: ({ row }) =>
        row.userIdName || row.userId || row.anonId || EMPTY_TEXT,
    },
    {
      field: 'pageUrl',
      title: $t('tracking.events.page'),
      minWidth: 160,
      slots: { default: 'pageUrl' },
    },
    {
      field: 'success',
      title: $t('tracking.events.result'),
      width: 90,
      cellRender: { name: 'CellTag', options: resultOptions() },
    },
    {
      field: 'durationMs',
      title: $t('tracking.events.durationMs'),
      align: 'right',
      width: 100,
      slots: { default: 'durationMs' },
    },
    // 以下为低频排查字段：默认隐藏，需要时在「列设置」里打开
    {
      field: 'appId',
      title: $t('tracking.events.appId'),
      visible: false,
      width: 150,
    },
    {
      field: 'sessionId',
      title: $t('tracking.events.sessionId'),
      visible: false,
      minWidth: 160,
    },
    {
      field: 'traceId',
      title: $t('tracking.events.traceId'),
      visible: false,
      minWidth: 160,
    },
    {
      field: 'eventId',
      title: $t('tracking.events.eventId'),
      visible: false,
      minWidth: 180,
    },
    {
      field: 'eventTime',
      title: $t('tracking.events.eventTime'),
      visible: false,
      width: 170,
    },
    {
      field: 'ip',
      title: $t('tracking.events.ip'),
      visible: false,
      width: 140,
    },
    {
      field: 'referrer',
      title: $t('tracking.events.referrer'),
      visible: false,
      minWidth: 180,
    },
    {
      field: 'userAgent',
      title: $t('tracking.events.userAgent'),
      visible: false,
      minWidth: 200,
    },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 116,
      slots: { default: 'action' },
    },
  ];
}

export function useGridFormSchema(): FormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: {
        class: 'w-full',
        options: [
          { label: $t('tracking.events.range15m'), value: '15m' },
          { label: $t('tracking.events.range1h'), value: '1h' },
          { label: $t('tracking.events.range24h'), value: '24h' },
          { label: $t('tracking.events.range7d'), value: '7d' },
          { label: $t('tracking.events.rangeCustom'), value: 'custom' },
        ],
      },
      defaultValue: '24h',
      fieldName: 'quickRange',
      label: $t('tracking.events.timeRange'),
    },
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: $t('tracking.events.keywordPlaceholder'),
      },
      fieldName: 'keyword',
      label: $t('tracking.events.keyword'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        optionFilterProp: 'label',
        options: eventCodeOptions(),
        showSearch: true,
      },
      fieldName: 'eventCode',
      label: $t('tracking.events.eventCode'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        options: resultOptions(),
      },
      fieldName: 'success',
      label: $t('tracking.events.result'),
    },
    // 时间范围拆成两个字段：后端按 startTime/endTime 过滤，且要求
    // `yyyy-MM-dd HH:mm:ss`（只给日期会把当天的事件全部排除在 endTime 之外）。
    // 仅选择「自定义」时展示，避免和快捷范围同时生效造成口径冲突。
    {
      component: 'DatePicker',
      componentProps: {
        class: 'w-full',
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      dependencies: {
        show: (values) => values.quickRange === 'custom',
        triggerFields: ['quickRange'],
      },
      fieldName: 'startTime',
      label: $t('tracking.events.startTime'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        class: 'w-full',
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      dependencies: {
        show: (values) => values.quickRange === 'custom',
        triggerFields: ['quickRange'],
      },
      fieldName: 'endTime',
      label: $t('tracking.events.endTime'),
    },
    {
      component: 'Input',
      componentProps: { allowClear: true },
      fieldName: 'appId',
      label: $t('tracking.events.appId'),
    },
    {
      component: 'Input',
      componentProps: { allowClear: true },
      fieldName: 'userId',
      label: $t('tracking.events.userId'),
    },
    {
      component: 'Input',
      componentProps: { allowClear: true },
      fieldName: 'traceId',
      label: $t('tracking.events.traceId'),
    },
    {
      component: 'Input',
      componentProps: { allowClear: true },
      fieldName: 'sessionId',
      label: $t('tracking.events.sessionId'),
    },
  ];
}
