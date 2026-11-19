import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('system.platformUser.userName'),
      componentProps: { allowClear: true },
    },
    {
      component: 'Input',
      fieldName: 'realName',
      label: $t('system.platformUser.realName'),
      componentProps: { allowClear: true },
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: $t('system.platformUser.status'),
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
    },
  ];
}

export function useColumns<T>(
  onStatusChange?: (newStatus: 0 | 1, row: T) => Promise<boolean>,
): VxeTableGridColumns {
  return [
    {
      field: 'username',
      title: $t('system.platformUser.userName'),
      minWidth: 160,
    },
    {
      field: 'realName',
      title: $t('system.platformUser.realName'),
      minWidth: 120,
    },
    {
      field: 'nickname',
      title: $t('system.platformUser.nickname'),
      minWidth: 120,
    },
    {
      field: 'status',
      title: $t('system.platformUser.status'),
      width: 100,
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
    },
    {
      field: 'lastLoginTime',
      title: $t('system.platformUser.lastLoginTime'),
      minWidth: 160,
    },
    {
      field: 'createTime',
      title: $t('system.platformUser.createTime'),
      minWidth: 160,
    },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 160,
      align: 'center',
      slots: { default: 'action' },
    },
  ];
}
