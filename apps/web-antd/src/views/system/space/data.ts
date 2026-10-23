import type { VxeTableGridColumns } from '@vben/plugins/vxe-table';

import type { VbenFormSchema } from '#/adapter/form';
import type { SystemSpaceApi } from '#/api/system/space';

import { z } from '#/adapter/form';
import { getDictOptions } from '#/api/system/dictItem';
import { getSpaceTree } from '#/api/system/space';
import { $t } from '#/locales';

import { collectSubtreeIds } from '../_shared/space-tree';

/**
 * 空间管理表单 schema。
 *
 * 分三段排列（基本信息 / 位置属性 / 责任与状态），因为空间类型不同要填的字段不同：
 * 园区/楼栋填地址经纬度，房间填楼层号/房间号，办公室填容量。全平铺会让用户面对一堆无关字段。
 */
export function useSchema(): VbenFormSchema[] {
  return [
    {
      component: 'ApiTreeSelect',
      componentProps: {
        allowClear: true,
        // **排除自身及其子树**：把空间挂到自己下面会形成环。后端会拒绝并报错，
        // 但让用户在候选列表里根本看不到（而不是选完再报错）才是正确交互。
        // 编辑时 `id` 由 form.vue 先 setValues 写进表单值，这里从 values 读。
        api: async (values?: { id?: string }) => {
          const tree = (await getSpaceTree()) ?? [];
          if (!values?.id) {
            return tree;
          }
          const exclude = new Set(collectSubtreeIds(tree, values.id));
          const prune = (nodes: any[]): any[] =>
            nodes
              .filter((node) => !exclude.has(node.id))
              .map((node) => ({
                ...node,
                children: node.children ? prune(node.children) : undefined,
              }));
          return prune(tree);
        },
        childrenField: 'children',
        class: 'w-full',
        labelField: 'name',
        valueField: 'id',
      },
      fieldName: 'pid',
      label: $t('system.space.parentSpace'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 128, showCount: true },
      fieldName: 'name',
      label: $t('system.space.name'),
      rules: z
        .string()
        .min(1, $t('ui.formRules.required', [$t('system.space.name')]))
        .max(128, $t('ui.formRules.maxLength', [$t('system.space.name'), 128])),
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 64,
        placeholder: $t('system.space.codePlaceholder'),
      },
      fieldName: 'code',
      label: $t('system.space.code'),
      rules: z
        .string()
        .regex(/^[A-Za-z0-9_-]{0,64}$/, $t('system.space.codeRule'))
        .optional()
        .or(z.literal('')),
    },
    {
      component: 'ApiSelect',
      componentProps: {
        api: () => getDictOptions('space_type'),
        class: 'w-full',
        labelField: 'label',
        valueField: 'value',
      },
      fieldName: 'spaceType',
      label: $t('system.space.spaceType'),
      rules: z
        .string()
        .min(1, $t('ui.formRules.required', [$t('system.space.spaceType')])),
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      defaultValue: 0,
      fieldName: 'sort',
      label: $t('system.space.sort'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 255 },
      fieldName: 'address',
      label: $t('system.space.address'),
    },
    {
      // 经纬度必须可填：后端实体这两个字段是 updateStrategy=ALWAYS（允许清空），
      // 若表单不提供它们、提交时又发 null，**每次保存都会把已有坐标静默清空**。
      component: 'InputNumber',
      componentProps: {
        class: 'w-full',
        max: 180,
        min: -180,
        placeholder: '如 116.397',
        precision: 6,
      },
      fieldName: 'longitude',
      label: $t('system.space.longitude'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        class: 'w-full',
        max: 90,
        min: -90,
        placeholder: '如 39.908',
        precision: 6,
      },
      fieldName: 'latitude',
      label: $t('system.space.latitude'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 16 },
      fieldName: 'floorNo',
      label: $t('system.space.floorNo'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 32 },
      fieldName: 'roomNo',
      label: $t('system.space.roomNo'),
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0, precision: 2 },
      fieldName: 'area',
      label: $t('system.space.area'),
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'capacity',
      label: $t('system.space.capacity'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 64 },
      fieldName: 'manager',
      label: $t('system.space.manager'),
    },
    {
      component: 'Input',
      componentProps: { maxlength: 20 },
      fieldName: 'phone',
      label: $t('system.space.phone'),
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
      label: $t('system.space.status'),
    },
    {
      component: 'Textarea',
      componentProps: { maxlength: 500, rows: 3, showCount: true },
      fieldName: 'remark',
      label: $t('system.space.remark'),
    },
    {
      component: 'Textarea',
      componentProps: {
        placeholder: $t('system.space.extJsonPlaceholder'),
        rows: 3,
      },
      fieldName: 'extJson',
      label: $t('system.space.extJson'),
      help: $t('system.space.extJsonHelp'),
    },
  ];
}

/**
 * 空间树形表格列。
 *
 * 用 `treeNode: true` 挂在「名称」列上（与部门页同一套 vxe 树形配置），
 * 层级由后端 `pid` 决定，前端不自行推断。
 */
export function useColumns(): VxeTableGridColumns<SystemSpaceApi.SpaceResp> {
  return [
    {
      align: 'left',
      field: 'name',
      fixed: 'left',
      minWidth: 240,
      title: $t('system.space.name'),
      treeNode: true,
    },
    {
      field: 'spaceTypeText',
      slots: { default: 'spaceType' },
      title: $t('system.space.spaceType'),
      width: 120,
    },
    {
      field: 'code',
      title: $t('system.space.code'),
      width: 140,
    },
    {
      field: 'floorNo',
      title: $t('system.space.floorNo'),
      width: 90,
    },
    {
      field: 'roomNo',
      title: $t('system.space.roomNo'),
      width: 100,
    },
    {
      field: 'manager',
      title: $t('system.space.manager'),
      width: 110,
    },
    {
      field: 'phone',
      title: $t('system.space.phone'),
      width: 130,
    },
    {
      // 关联对象数由后端一次分组查询给出（不是前端逐行算）
      field: 'relationCount',
      title: $t('system.space.relationCount'),
      width: 110,
    },
    {
      field: 'status',
      cellRender: { name: 'CellTag' },
      title: $t('system.space.status'),
      width: 100,
    },
    {
      field: 'sort',
      title: $t('system.space.sort'),
      width: 80,
    },
    {
      field: 'remark',
      minWidth: 140,
      title: $t('system.space.remark'),
    },
    {
      align: 'center',
      field: 'action',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('common.action'),
      width: 220,
    },
  ];
}
