import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'name', title: $t('system.post.name'), minWidth: 120 },
    { field: 'code', title: $t('system.post.code'), minWidth: 120 },
    { field: 'sort', title: $t('system.post.sort'), width: 80 },
    {
      field: 'status',
      title: $t('system.post.status'),
      width: 100,
      cellRender: { name: 'CellTag' },
    },
    { field: 'createTime', title: $t('system.role.createTime'), width: 160 },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 160,
      slots: { default: 'action' },
    },
  ];
}

export function useGridFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.post.name'),
      componentProps: { allowClear: true },
    },
    {
      component: 'Input',
      fieldName: 'code',
      label: $t('system.post.code'),
      componentProps: { allowClear: true },
    },
  ];
}
