import type { VxeTableGridColumns } from '@vben/plugins/vxe-table';

import type { VbenFormSchema } from '#/adapter/form';
import type { SystemDictItemApi } from '#/api/system/dictItem';

import { h } from 'vue';

import { Tag } from 'ant-design-vue';

import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'label',
      label: $t('system.dictItem.label'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'value',
      label: $t('system.dictItem.value'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      defaultValue: 1,
      fieldName: 'sort',
      label: $t('system.dictItem.sort'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.dictItem.status'),
    },
    {
      component: 'Select',
      fieldName: 'color',
      label: $t('system.dictItem.color'),
      componentProps: {
        allowClear: true,
        options: getColorOptions(),
      },
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('common.remark'),
    },
  ];
}

/** 字典项标签颜色预设（对齐 antd Tag / CellTag 支持的语义色） */
export function getColorOptions() {
  return [
    { label: $t('system.dictItem.colorDefault'), value: 'default' },
    { label: $t('system.dictItem.colorSuccess'), value: 'success' },
    { label: $t('system.dictItem.colorProcessing'), value: 'processing' },
    { label: $t('system.dictItem.colorWarning'), value: 'warning' },
    { label: $t('system.dictItem.colorError'), value: 'error' },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'label',
      label: $t('system.dictItem.label'),
    },
  ];
}

export function useColumns(): VxeTableGridColumns<SystemDictItemApi.DictItemResp> {
  return [
    {
      align: 'left',
      field: 'label',
      title: $t('system.dictItem.label'),
      minWidth: 100,
    },
    {
      field: 'value',
      title: $t('system.dictItem.value'),
      minWidth: 100,
    },
    {
      field: 'color',
      title: $t('system.dictItem.color'),
      width: 120,
      slots: {
        default: ({ row }) =>
          row.color
            ? h(Tag, { color: row.color }, () => row.label)
            : (row.label ?? ''),
      },
    },
    {
      field: 'remark',
      title: $t('common.remark'),
      minWidth: 120,
    },
    {
      field: 'sort',
      title: $t('system.dictItem.sort'),
      width: 60,
    },
    {
      field: 'status',
      title: $t('system.dictItem.status'),
      cellRender: { name: 'CellTag' },
      width: 80,
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
