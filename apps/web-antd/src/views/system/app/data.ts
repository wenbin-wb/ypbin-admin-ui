import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemAppApi } from '#/api/system/app';

import { $t } from '#/locales';

export function useColumns(
  onStatusChange?: (
    status: number,
    row: SystemAppApi.AppResp,
  ) => Promise<boolean>,
): VxeTableGridColumns {
  return [
    { field: 'appName', title: $t('system.app.appName'), minWidth: 150 },
    { field: 'accessKey', title: $t('system.app.accessKey'), minWidth: 150 },
    { field: 'expireTime', title: $t('system.app.expireTime'), width: 160 },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'enabled',
      title: $t('system.app.enabled'),
      width: 100,
    },
    { field: 'createTime', title: $t('system.app.createTime'), width: 160 },
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

export function useFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'appName',
      label: $t('system.app.appName'),
      rules: 'required',
    },
    {
      component: 'DatePicker',
      fieldName: 'expireTime',
      label: $t('system.app.expireTime'),
      componentProps: { showTime: true, valueFormat: 'YYYY-MM-DD HH:mm:ss' },
    },
    {
      component: 'RadioGroup',
      fieldName: 'enabled',
      label: $t('system.app.enabled'),
      componentProps: {
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      defaultValue: 1,
    },
  ];
}
