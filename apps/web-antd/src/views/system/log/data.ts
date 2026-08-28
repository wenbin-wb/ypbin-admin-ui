import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { h } from 'vue';

import { Tag } from 'ant-design-vue';

import { $t } from '#/locales';

export function useColumns(): VxeTableGridColumns {
  return [
    {
      field: 'description',
      title: $t('system.log.description'),
      minWidth: 120,
    },
    {
      field: 'operateUserIdName',
      title: $t('common.operator'),
      width: 120,
    },
    { field: 'module', title: $t('system.log.module'), width: 100 },
    { field: 'requestUri', title: 'URI', minWidth: 150 },
    { field: 'ip', title: 'IP', width: 120 },
    { field: 'location', title: $t('system.log.location'), width: 120 },
    { field: 'browser', title: $t('system.log.browser'), minWidth: 160 },
    { field: 'os', title: 'OS', minWidth: 140 },
    {
      field: 'timeTaken',
      title: $t('system.log.timeTaken'),
      width: 80,
      formatter: ({ cellValue }) => (cellValue ? `${cellValue} ms` : ''),
    },
    {
      field: 'success',
      title: $t('system.log.status'),
      width: 80,
      slots: {
        default: ({ row }) => {
          const isSuccess = row.success === 1;
          return h(Tag, { color: isSuccess ? 'success' : 'error' }, () =>
            isSuccess ? $t('system.log.success') : $t('system.log.fail'),
          );
        },
      },
    },
    { field: 'operateTime', title: $t('system.log.createTime'), width: 160 },
    {
      title: $t('system.log.action'),
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
      fieldName: 'module',
      label: $t('system.log.module'),
      componentProps: { allowClear: true },
    },
    {
      component: 'Input',
      fieldName: 'requestUri',
      label: 'URI',
      componentProps: { allowClear: true },
    },
    {
      component: 'Input',
      fieldName: 'ip',
      label: 'IP',
      componentProps: { allowClear: true },
    },
    {
      component: 'Select',
      fieldName: 'success',
      label: $t('system.log.status'),
      componentProps: {
        options: [
          { label: $t('system.log.success'), value: 1 },
          { label: $t('system.log.fail'), value: 0 },
        ],
        allowClear: true,
      },
    },
  ];
}
