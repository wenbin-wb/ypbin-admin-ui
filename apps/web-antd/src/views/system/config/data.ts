import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'name', title: $t('system.config.configName'), minWidth: 120 },
    {
      field: 'configGroup',
      title: $t('system.config.configGroup'),
      minWidth: 120,
    },
    { field: 'configKey', title: $t('system.config.configKey'), minWidth: 120 },
    {
      field: 'configValue',
      title: $t('system.config.configValue'),
      minWidth: 120,
    },
    { field: 'remark', title: $t('system.config.remark'), minWidth: 120 },
    {
      field: 'createTime',
      title: $t('system.config.createTime'),
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
      label: $t('system.config.configName'),
      componentProps: { allowClear: true },
    },
    {
      component: 'Input',
      fieldName: 'configGroup',
      label: $t('system.config.configGroup'),
      componentProps: { allowClear: true },
    },
    {
      component: 'Input',
      fieldName: 'configKey',
      label: $t('system.config.configKey'),
      componentProps: { allowClear: true },
    },
  ];
}
