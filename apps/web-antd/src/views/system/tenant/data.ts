import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { getAuthTemplateList } from '#/api/system/auth-template';
import { $t } from '#/locales';

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'name', title: $t('system.tenant.name'), minWidth: 150 },
    { field: 'code', title: $t('system.tenant.code'), minWidth: 120 },
    {
      // 后端 @RefText("template") 自动输出 templateIdName（模板名称）
      field: 'templateIdName',
      title: $t('system.tenant.templateId'),
      width: 150,
    },
    {
      field: 'contactName',
      title: $t('system.tenant.contactName'),
      width: 120,
    },
    {
      field: 'contactPhone',
      title: $t('system.tenant.contactPhone'),
      width: 120,
    },
    { field: 'expireDate', title: $t('system.tenant.expireDate'), width: 120 },
    { field: 'remark', title: $t('common.remark'), minWidth: 120 },
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
      label: $t('system.tenant.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'code',
      label: $t('system.tenant.code'),
      rules: 'required',
    },
    {
      component: 'ApiSelect',
      fieldName: 'templateId',
      label: $t('system.tenant.templateId'),
      componentProps: {
        api: () => getAuthTemplateList(),
        labelField: 'name',
        valueField: 'id',
        allowClear: true,
      },
    },
    {
      component: 'Input',
      fieldName: 'contactName',
      label: $t('system.tenant.contactName'),
    },
    {
      component: 'Input',
      fieldName: 'contactPhone',
      label: $t('system.tenant.contactPhone'),
    },
    {
      component: 'DatePicker',
      fieldName: 'expireDate',
      label: $t('system.tenant.expireDate'),
      componentProps: { valueFormat: 'YYYY-MM-DD' },
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('common.remark'),
    },
  ];
}
