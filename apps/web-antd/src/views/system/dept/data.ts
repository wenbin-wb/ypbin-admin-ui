import type { VxeTableGridColumns } from '@vben/plugins/vxe-table';

import type { VbenFormSchema } from '#/adapter/form';
import type { SystemDeptApi } from '#/api/system/dept';

import { z } from '#/adapter/form';
import { getDeptList } from '#/api/system/dept';
import { $t } from '#/locales';

/**
 * 获取编辑表单的字段配置。如果没有使用多语言，可以直接export一个数组常量
 */
export function useSchema(): VbenFormSchema[] {
  return [
    {
      component: 'ApiTreeSelect',
      componentProps: {
        allowClear: true,
        api: getDeptList,
        class: 'w-full',
        labelField: 'name',
        valueField: 'id',
        childrenField: 'children',
      },
      fieldName: 'pid',
      label: $t('system.dept.parentDept'),
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.dept.deptName'),
      rules: z
        .string()
        .min(2, $t('ui.formRules.minLength', [$t('system.dept.deptName'), 2]))
        .max(
          20,
          $t('ui.formRules.maxLength', [$t('system.dept.deptName'), 20]),
        ),
    },
    {
      component: 'InputNumber',
      fieldName: 'sort',
      label: $t('system.dept.sort'),
      defaultValue: 0,
    },
    {
      component: 'Input',
      fieldName: 'leader',
      label: $t('system.dept.leader'),
    },
    {
      component: 'Input',
      fieldName: 'phone',
      label: $t('system.dept.phone'),
    },
    {
      component: 'Input',
      fieldName: 'email',
      label: $t('system.dept.email'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.dept.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.dept.remark'),
    },
  ];
}

/**
 * 获取表格列配置
 * @description 使用函数的形式返回列数据而不是直接export一个Array常量，是为了响应语言切换时重新翻译表头
 */
export function useColumns(): VxeTableGridColumns<SystemDeptApi.SystemDept> {
  return [
    {
      align: 'left',
      field: 'name',
      fixed: 'left',
      title: $t('system.dept.deptName'),
      treeNode: true,
      minWidth: 200,
    },
    {
      field: 'leader',
      title: $t('system.dept.leader'),
      width: 120,
    },
    {
      field: 'phone',
      title: $t('system.dept.phone'),
      width: 130,
    },
    {
      field: 'sort',
      title: $t('system.dept.sort'),
      width: 80,
    },
    {
      field: 'status',
      cellRender: {
        name: 'CellTag',
      },
      title: $t('system.dept.status'),
      width: 100,
    },
    {
      field: 'createTime',
      title: $t('system.dept.createTime'),
      width: 170,
    },
    {
      field: 'createUserName',
      title: $t('common.creator'),
      width: 120,
    },
    {
      field: 'remark',
      title: $t('system.dept.remark'),
      minWidth: 150,
    },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 200,
      align: 'center',
      slots: { default: 'action' },
    },
  ];
}
