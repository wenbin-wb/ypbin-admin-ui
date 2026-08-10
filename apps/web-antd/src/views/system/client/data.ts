import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'clientId', title: $t('system.client.clientId'), minWidth: 120 },
    {
      field: 'clientType',
      title: $t('system.client.clientType'),
      minWidth: 120,
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
