import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemClientApi } from '#/api/system/client';

import { $t } from '#/locales';

/**
 * 秒数转可读时长：整小时/整天直接换算，其余按分钟/秒展示；-1 用传入的兜底文案。
 */
function secondsText(
  value: null | number | string | undefined,
  fallback: string,
) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const seconds = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(seconds)) {
    return '';
  }
  if (seconds === -1) {
    return fallback;
  }
  if (seconds % 86_400 === 0) {
    return `${seconds / 86_400}${$t('system.client.days')}`;
  }
  if (seconds % 3600 === 0) {
    return `${seconds / 3600}${$t('system.client.hours')}`;
  }
  if (seconds % 60 === 0) {
    return `${seconds / 60}${$t('system.client.minutes')}`;
  }
  return `${seconds}${$t('system.client.seconds')}`;
}

export function useColumns<T = SystemClientApi.ClientResp>(
  onStatusChange?: (newStatus: 0 | 1, row: T) => Promise<boolean>,
): VxeTableGridColumns {
  return [
    { field: 'clientId', title: $t('system.client.clientId'), minWidth: 130 },
    {
      field: 'clientType',
      title: $t('system.client.clientType'),
      width: 110,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.client.status'),
      width: 90,
    },
    {
      field: 'timeout',
      title: $t('system.client.timeout'),
      width: 110,
      formatter: ({ cellValue }) =>
        secondsText(cellValue, $t('system.client.permanent')),
    },
    {
      field: 'activeTimeout',
      title: $t('system.client.activeTimeout'),
      width: 120,
      formatter: ({ cellValue }) =>
        secondsText(cellValue, $t('system.client.unlimited')),
    },
    {
      field: 'concurrentEnabled',
      title: $t('system.client.concurrentEnabled'),
      width: 100,
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'success', label: $t('common.enabled'), value: 1 },
          { color: 'default', label: $t('common.disabled'), value: 0 },
        ],
      },
    },
    {
      field: 'maxLoginCount',
      title: $t('system.client.maxLoginCount'),
      width: 110,
      formatter: ({ cellValue }) =>
        cellValue === null || cellValue === undefined || cellValue === ''
          ? $t('system.client.unlimited')
          : cellValue,
    },
    { field: 'remark', title: $t('system.client.remark'), minWidth: 140 },
    { field: 'createTime', title: $t('system.client.createTime'), width: 160 },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 240,
      align: 'center',
      slots: { default: 'action' },
    },
  ];
}

export function useGridFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'clientId',
      label: $t('system.client.clientId'),
      componentProps: { allowClear: true },
    },
    {
      component: 'Input',
      fieldName: 'clientType',
      label: $t('system.client.clientType'),
      componentProps: { allowClear: true },
    },
  ];
}
