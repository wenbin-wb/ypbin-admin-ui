import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemClientApi } from '#/api/system/client';

import { $t } from '#/locales';

export function useColumns<T = SystemClientApi.ClientResp>(
  onStatusChange?: (newStatus: 0 | 1, row: T) => Promise<boolean>,
): VxeTableGridColumns {
  return [
    { field: 'clientId', title: $t('system.client.clientId'), minWidth: 120 },
    {
      field: 'clientType',
      title: $t('system.client.clientType'),
      minWidth: 120,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.client.status'),
      width: 100,
    },
    { field: 'timeout', title: $t('system.client.timeout'), width: 100 },
    { field: 'remark', title: $t('system.client.remark'), minWidth: 120 },
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
