import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'name', title: $t('system.authTemplate.name'), minWidth: 150 },
    { field: 'code', title: $t('system.authTemplate.code'), minWidth: 120 },
    { field: 'remark', title: $t('common.remark'), minWidth: 150 },
    { field: 'createUserName', title: $t('common.creator'), width: 120 },
    { field: 'createTime', title: $t('common.createTime'), width: 160 },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 160,
      slots: { default: 'action' },
    },
  ];
}

export function useFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.authTemplate.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'code',
      label: $t('system.authTemplate.code'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'menuIds',
      formItemClass: 'items-start',
      label: $t('system.authTemplate.menuIds'),
      modelPropName: 'modelValue',
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('common.remark'),
    },
  ];
}
