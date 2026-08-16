import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { $t } from '#/locales';

/** 新建知识库表单 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('page.ai.knowledge.name'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: { rows: 3 },
      fieldName: 'description',
      label: $t('page.ai.knowledge.description'),
    },
    {
      component: 'Input',
      fieldName: 'remark',
      label: $t('common.remark'),
    },
  ];
}

/** 搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('page.ai.knowledge.name'),
    },
  ];
}

/** 列定义 */
export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'name', title: $t('page.ai.knowledge.name'), minWidth: 160 },
    {
      field: 'description',
      title: $t('page.ai.knowledge.description'),
      minWidth: 240,
      showOverflow: true,
    },
    {
      field: 'docCount',
      title: $t('page.ai.knowledge.docCount'),
      minWidth: 90,
    },
    {
      field: 'createTime',
      title: $t('common.createTime'),
      minWidth: 170,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('common.action'),
      minWidth: 160,
    },
  ];
}

export type KnowledgeBaseRow = AiApi.KnowledgeBase;
