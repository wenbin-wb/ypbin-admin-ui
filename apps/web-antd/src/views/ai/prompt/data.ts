import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { $t } from '#/locales';

/** 新增/编辑表单 */
export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('page.ai.prompt.name'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('page.ai.prompt.categoryCoding'), value: 'coding' },
          { label: $t('page.ai.prompt.categoryWriting'), value: 'writing' },
          { label: $t('page.ai.prompt.categoryAnalysis'), value: 'analysis' },
          { label: $t('page.ai.prompt.categoryTranslation'), value: 'translation' },
          { label: $t('page.ai.prompt.categoryQa'), value: 'qa' },
          { label: $t('page.ai.prompt.categoryOther'), value: 'other' },
        ],
      },
      fieldName: 'category',
      label: $t('page.ai.prompt.category'),
    },
    {
      component: 'Textarea',
      componentProps: { rows: 8 },
      fieldName: 'template',
      help: $t('page.ai.prompt.placeholderDetail'),
      label: $t('page.ai.prompt.template'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'description',
      label: $t('page.ai.prompt.description'),
    },
  ];
}

/** 搜索表单 */
export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('page.ai.prompt.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('page.ai.prompt.categoryCoding'), value: 'coding' },
          { label: $t('page.ai.prompt.categoryWriting'), value: 'writing' },
          { label: $t('page.ai.prompt.categoryAnalysis'), value: 'analysis' },
          { label: $t('page.ai.prompt.categoryTranslation'), value: 'translation' },
          { label: $t('page.ai.prompt.categoryQa'), value: 'qa' },
          { label: $t('page.ai.prompt.categoryOther'), value: 'other' },
        ],
      },
      fieldName: 'category',
      label: $t('page.ai.prompt.category'),
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
      label: $t('page.ai.prompt.status'),
    },
  ];
}

/** 列定义 */
export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'name', title: $t('page.ai.prompt.name'), minWidth: 160 },
    {
      field: 'category',
      title: $t('page.ai.prompt.category'),
      minWidth: 110,
      slots: { default: 'category' },
    },
    {
      field: 'description',
      title: $t('page.ai.prompt.description'),
      minWidth: 220,
      showOverflow: true,
    },
    {
      cellRender: { name: 'CellTag' },
      field: 'status',
      title: $t('page.ai.prompt.status'),
      minWidth: 100,
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
      minWidth: 150,
    },
  ];
}

export type PromptRow = AiApi.PromptTemplate;
