import type { DescriptionsItemType } from '@vben/common-ui';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api';

import { h } from 'vue';

import { Tag } from 'ant-design-vue';

import { getDeptList, getPostList } from '#/api';
import { $t } from '#/locales';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('system.user.userName'),
      rules: 'required',
    },
    {
      component: 'InputPassword',
      fieldName: 'password',
      label: $t('system.user.password'),
    },
    {
      component: 'Input',
      fieldName: 'realName',
      label: $t('system.user.realName'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'nickname',
      label: $t('system.user.nickname'),
    },
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
      fieldName: 'deptId',
      label: $t('system.user.dept'),
    },
    {
      component: 'Input',
      fieldName: 'phone',
      label: $t('system.user.phone'),
    },
    { component: 'Input', fieldName: 'email', label: $t('system.user.email') },
    {
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: $t('system.user.genderUnknown'), value: 0 },
          { label: $t('system.user.genderMale'), value: 1 },
          { label: $t('system.user.genderFemale'), value: 2 },
        ],
        optionType: 'button',
      },
      defaultValue: 0,
      fieldName: 'gender',
      label: $t('system.user.gender'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: $t('common.enabled'), value: 1 },
          { label: $t('common.disabled'), value: 0 },
        ],
        optionType: 'button',
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.user.status'),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: getPostList,
        labelField: 'name',
        valueField: 'id',
        mode: 'multiple',
        allowClear: true,
        class: 'w-full',
        optionLabelProp: 'label',
      },
      fieldName: 'postIds',
      label: $t('system.user.posts'),
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.user.remark'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'username',
      label: $t('system.user.userName'),
    },
    {
      component: 'Input',
      fieldName: 'realName',
      label: $t('system.user.realName'),
    },
    {
      component: 'Input',
      fieldName: 'phone',
      label: $t('system.user.phone'),
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
      label: $t('system.user.status'),
    },
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
      fieldName: 'deptId',
      label: $t('system.user.dept'),
    },
  ];
}

export function useDescriptionItems(
  row?: SystemUserApi.SystemUser,
): DescriptionsItemType[] {
  const enabled = row?.status === 1;
  return [
    { label: $t('system.user.userName'), content: row?.username },
    { label: $t('system.user.realName'), content: row?.realName },
    { label: $t('system.user.nickname'), content: row?.nickname },
    {
      label: $t('system.user.dept'),
      content: row?.deptIdName,
    },
    { label: $t('system.user.phone'), content: row?.phone },
    { label: $t('system.user.email'), content: row?.email },
    { label: $t('system.user.gender'), content: row?.genderText },
    {
      label: $t('system.user.status'),
      content: () =>
        h(
          Tag,
          { color: enabled ? 'success' : 'error' },
          {
            default: () =>
              enabled ? $t('common.enabled') : $t('common.disabled'),
          },
        ),
    },
    { label: $t('system.user.lastLoginTime'), content: row?.lastLoginTime },
    { label: $t('system.user.createTime'), content: row?.createTime },
    { label: $t('system.user.remark'), content: row?.remark },
  ];
}

export function useColumns<T = SystemUserApi.SystemUser>(
  onStatusChange?: (newStatus: 0 | 1, row: T) => Promise<boolean>,
): VxeTableGridColumns {
  return [
    { field: 'username', title: $t('system.user.userName'), minWidth: 120 },
    { field: 'realName', title: $t('system.user.realName'), minWidth: 120 },
    { field: 'nickname', title: $t('system.user.nickname'), minWidth: 120 },
    { field: 'deptIdName', title: $t('system.user.dept'), minWidth: 150 },
    { field: 'phone', title: $t('system.user.phone'), minWidth: 120 },
    { field: 'email', title: $t('system.user.email'), minWidth: 180 },
    { field: 'genderText', title: $t('system.user.gender'), minWidth: 80 },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'status',
      title: $t('system.user.status'),
      minWidth: 100,
    },
    {
      field: 'lastLoginTime',
      title: $t('system.user.lastLoginTime'),
      minWidth: 160,
    },
    { field: 'createUserName', title: $t('common.creator'), minWidth: 100 },
    { field: 'createTime', title: $t('system.user.createTime'), minWidth: 160 },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('system.user.operation'),
      minWidth: 180,
    },
  ];
}
