import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { h } from 'vue';

import { Switch } from 'ant-design-vue';

import { $t } from '#/locales';

export function useColumns<T = Record<string, any>>(
  onStatusChange: (status: number, row: T) => Promise<boolean>,
): VxeTableGridColumns {
  return [
    { field: 'appName', title: $t('system.app.appName'), minWidth: 150 },
    { field: 'accessKey', title: $t('system.app.accessKey'), minWidth: 150 },
    {
      field: 'secretKey',
      title: $t('system.app.secretKey'),
      minWidth: 150,
      formatter: () => '******',
    },
    { field: 'expireTime', title: $t('system.app.expireTime'), width: 160 },
    {
      field: 'enabled',
      title: $t('system.app.enabled'),
      width: 100,
      slots: {
        default: (e) => {
          return h(Switch, {
            checked: e.row.enabled === 1,
            checkedChildren: $t('common.enabled'),
            unCheckedChildren: $t('common.disabled'),
            onChange: (checked) => {
              onStatusChange(checked ? 1 : 0, e.row);
            },
          });
        },
      },
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

export function useGridFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'appName',
      label: $t('system.app.appName'),
      componentProps: { allowClear: true },
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
