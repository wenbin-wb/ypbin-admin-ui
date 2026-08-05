import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeGridProps } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useColumns(): VxeGridProps['columns'] {
  return [
    {
      field: 'originalName',
      title: $t('system.file.originalName'),
      minWidth: 150,
    },
    { field: 'fileName', title: $t('system.file.fileName'), minWidth: 150 },
    { field: 'fileSize', title: $t('system.file.fileSize'), width: 100 },
    { field: 'extension', title: $t('system.file.extension'), width: 100 },
    { field: 'module', title: $t('system.log.module'), width: 120 },
    { field: 'createTime', title: $t('system.role.createTime'), width: 160 },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 200,
      slots: { default: 'action' },
    },
  ];
}

export function useGridFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'originalName',
      label: $t('system.file.originalName'),
      componentProps: { allowClear: true },
    },
  ];
}
