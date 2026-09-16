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
  return Object.values(TRACKING_EVENT_CATALOG).map((event) => ({
    label: $t('tracking.events.eventCodeOption', [
      event.code,
      event.description,
    ]),
    value: event.code,
  }));
}

export function useColumns(): VxeTableGridColumns {
  return [
    {
      field: 'eventCode',
      title: $t('tracking.events.eventCode'),
      minWidth: 200,
      slots: { default: 'eventCode' },
    },
    { field: 'appId', title: $t('tracking.events.appId'), width: 150 },
    {
      field: 'userId',
      title: $t('tracking.events.userId'),
      width: 140,
      // 后端 `@RefText("user")` 派生字段优先：有展示名时用展示名，缺失时回退裸 ID
      formatter: ({ row }) => row.userIdName || row.userId || '',
    },
    {
      field: 'sessionId',
      title: $t('tracking.events.sessionId'),
      minWidth: 160,
    },
    {
      field: 'pageUrl',
      title: $t('tracking.events.pageUrl'),
      minWidth: 220,
      slots: { default: 'pageUrl' },
    },
    {
      field: 'referrer',
      title: $t('tracking.events.referrer'),
      minWidth: 180,
      // 后端该字段常为空串（直接访问、上报方未带来源）
      formatter: ({ cellValue }) => cellValue || EMPTY_TEXT,
    },
    {
      field: 'ip',
      title: $t('tracking.events.ip'),
      width: 140,
      // 后端返回的已是脱敏值（如 183.179.215.0），前端不再加工
      formatter: ({ cellValue }) => cellValue || EMPTY_TEXT,
    },
    {
      field: 'durationMs',
      title: $t('tracking.events.durationMs'),
      width: 100,
      formatter: ({ cellValue }) => (cellValue ? `${cellValue} ms` : ''),
    },
    {
      field: 'success',
      title: $t('tracking.events.result'),
      width: 90,
      cellRender: { name: 'CellTag', options: resultOptions() },
    },
    {
      field: 'receivedTime',
      title: $t('tracking.events.receivedTime'),
      width: 170,
    },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 100,
      slots: { default: 'action' },
    },
  ];
}

export function useGridFormSchema(): FormSchema[] {
  return [
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
    // 时间范围拆成两个字段：后端按 startTime/endTime 两个参数过滤，且要求
    // `yyyy-MM-dd HH:mm:ss`（只给日期会把当天的事件全部排除在 endTime 之外）
    {
      component: 'DatePicker',
      componentProps: {
        class: 'w-full',
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
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
      fieldName: 'endTime',
      label: $t('tracking.events.endTime'),
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: resultOptions() },
      fieldName: 'success',
      label: $t('tracking.events.result'),
    },
  ];
}
