import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          {
            label: $t('page.ai.chat.roleCategory_assistant'),
            value: 'assistant',
          },
          {
            label: $t('page.ai.chat.roleCategory_translator'),
            value: 'translator',
          },
          { label: $t('page.ai.chat.roleCategory_coder'), value: 'coder' },
          { label: $t('page.ai.chat.roleCategory_analyst'), value: 'analyst' },
          { label: $t('page.ai.chat.roleCategory_writer'), value: 'writer' },
          { label: $t('page.ai.chat.roleCategory_custom'), value: 'custom' },
        ],
      },
      fieldName: 'category',
      label: $t('page.ai.role.category'),
    },
  ];
}

export function useColumns(): VxeTableGridColumns {
  return [
    {
      field: 'id',
      slots: { default: 'emoji' },
      title: '',
      width: 60,
    },
    {
      field: 'name',
      title: $t('page.ai.role.name'),
      minWidth: 120,
    },
    {
      field: 'description',
      title: $t('page.ai.role.description'),
      minWidth: 220,
      showOverflow: true,
    },
    {
      field: 'category',
      title: $t('page.ai.role.category'),
      minWidth: 100,
    },
    {
      field: 'temperature',
      title: $t('page.ai.role.temperature'),
      minWidth: 100,
    },
    {
      field: 'isBuiltin',
      slots: { default: 'builtin' },
      title: $t('page.ai.role.isBuiltin'),
      minWidth: 100,
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('common.action'),
      minWidth: 200,
    },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('page.ai.role.name'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          {
            label: $t('page.ai.chat.roleCategory_assistant'),
            value: 'assistant',
          },
          {
            label: $t('page.ai.chat.roleCategory_translator'),
            value: 'translator',
          },
          { label: $t('page.ai.chat.roleCategory_coder'), value: 'coder' },
          { label: $t('page.ai.chat.roleCategory_analyst'), value: 'analyst' },
          { label: $t('page.ai.chat.roleCategory_writer'), value: 'writer' },
          { label: $t('page.ai.chat.roleCategory_custom'), value: 'custom' },
        ],
      },
      fieldName: 'category',
      label: $t('page.ai.role.category'),
    },
    {
      component: 'Input',
      fieldName: 'modelPreference',
      label: $t('page.ai.role.modelPreference'),
    },
    {
      component: 'InputNumber',
      componentProps: {
        max: 2,
        min: 0,
        step: 0.1,
      },
      fieldName: 'temperature',
      label: $t('page.ai.role.temperature'),
    },
    {
      component: 'Input',
      fieldName: 'description',
      label: $t('page.ai.role.description'),
    },
    {
      component: 'Textarea',
      fieldName: 'systemPrompt',
      label: $t('page.ai.role.systemPrompt'),
      rules: 'required',
      componentProps: {
        autoSize: { maxRows: 12, minRows: 5 },
      },
    },
  ];
}
