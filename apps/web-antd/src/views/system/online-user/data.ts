import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'token', title: $t('system.onlineUser.token'), minWidth: 200 },
    {
      field: 'realName',
      title: $t('system.user.realName'),
      minWidth: 120,
    },
    { field: 'username', title: $t('system.onlineUser.username'), width: 120 },
    { field: 'location', title: $t('system.log.location'), width: 120 },
    { field: 'browser', title: $t('system.log.browser'), minWidth: 160 },
    { field: 'os', title: 'OS', minWidth: 140 },
    {
      field: 'loginTime',
      title: $t('system.onlineUser.loginTime'),
      width: 160,
    },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 100,
      slots: { default: 'action' },
    },
  ];
}

export function useGridFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('common.keyword'),
      componentProps: { allowClear: true },
    },
  ];
}
