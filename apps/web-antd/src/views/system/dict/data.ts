import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'name', title: $t('system.dict.name'), minWidth: 120 },
    { field: 'code', title: $t('system.dict.code'), minWidth: 120 },
    {
      field: 'status',
      title: $t('common.status'),
      width: 100,
      cellRender: { name: 'CellTag' },
    },
    { field: 'remark', title: $t('common.remark'), minWidth: 150 },
    {
      field: 'createTime',
      title: $t('common.createTime'),
      width: 160,
    },
    {
      field: 'createUserName',
      title: $t('common.creator'),
      width: 120,
    },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 220,
      slots: { default: 'action' },
    },
  ];
}

export function useGridFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.dict.name'),
      componentProps: { allowClear: true },
    },
    {
      component: 'Input',
      fieldName: 'code',
      label: $t('system.dict.code'),
      componentProps: { allowClear: true },
    },
  ];
}
