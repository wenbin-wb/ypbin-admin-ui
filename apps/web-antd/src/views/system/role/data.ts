import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api';

import { $t } from '#/locales';

export function getDataScopeOptions() {
  return [
    { label: $t('system.role.dataScopeList.all'), value: 1, color: 'success' },
    {
      label: $t('system.role.dataScopeList.custom'),
      value: 2,
      color: 'warning',
    },
    {
      label: $t('system.role.dataScopeList.dept'),
      value: 3,
      color: 'processing',
    },
    {
      label: $t('system.role.dataScopeList.deptAndChild'),
      value: 4,
      color: 'default',
    },
    { label: $t('system.role.dataScopeList.self'), value: 5, color: 'error' },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.role.roleName'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'code',
      label: $t('system.role.roleCode'),
      rules: 'required',
    },
    {
      component: 'Select',
      fieldName: 'dataScope',
      label: $t('system.role.dataScope'),
      componentProps: {
        options: getDataScopeOptions(),
      },
      defaultValue: 1,
    },
    {
      component: 'InputNumber',
      fieldName: 'sort',
      label: $t('system.role.sort'),
      defaultValue: 0,
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
      label: $t('system.role.status'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.role.remark'),
    },
    {
      component: 'Input',
      fieldName: 'permissions',
      formItemClass: 'items-start',
      label: $t('system.role.setPermissions'),
      modelPropName: 'modelValue',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.role.roleName'),
    },
    {
      component: 'Input',
      fieldName: 'code',
      label: $t('system.role.roleCode'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('system.role.status'),
    },
    {
      component: 'Input',
      fieldName: 'remark',
      label: $t('system.role.remark'),
    },
    {
      component: 'RangePicker',
      fieldName: 'createTime',
      label: $t('system.role.createTime'),
    },
  ];
}

export function useColumns<T = SystemRoleApi.SystemRole>(
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns {
  return [
    {
      field: 'name',
      title: $t('system.role.roleName'),
      width: 150,
    },
    {
      field: 'code',
      title: $t('system.role.roleCode'),
      width: 150,
    },
    {
      field: 'dataScope',
      title: $t('system.role.dataScope'),
      width: 180,
      cellRender: {
        name: 'CellTag',
        options: getDataScopeOptions(),
      },
    },
    {
      field: 'sort',
      title: $t('system.role.sort'),
      width: 80,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.role.status'),
      width: 100,
    },
    {
      field: 'remark',
      minWidth: 100,
      title: $t('system.role.remark'),
    },
    {
      field: 'createTime',
      title: $t('system.role.createTime'),
      width: 200,
    },
    {
      field: 'createUserName',
      title: $t('common.creator'),
      width: 120,
    },
    {
      align: 'center',
      title: $t('system.role.operation'),
      field: 'action',
      fixed: 'right',
      width: 160,
      slots: { default: 'action' },
    },
  ];
}
