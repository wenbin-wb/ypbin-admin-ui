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
      label: $t('page.ai.config.name'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          {
            label: $t('page.ai.config.providerOptions.deepseek'),
            value: 'deepseek',
          },
          {
            label: $t('page.ai.config.providerOptions.openai'),
            value: 'openai',
          },
          {
            label: $t('page.ai.config.providerOptions.ollama'),
            value: 'ollama',
          },
          {
            label: $t('page.ai.config.providerOptions.custom'),
            value: 'custom',
          },
        ],
      },
      fieldName: 'provider',
      label: $t('page.ai.config.provider'),
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          {
            label: $t('page.ai.config.modelTypeOptions.chat'),
            value: 'CHAT',
          },
          {
            label: $t('page.ai.config.modelTypeOptions.embedding'),
            value: 'EMBEDDING',
          },
        ],
        defaultValue: 'CHAT',
      },
      fieldName: 'modelType',
      label: $t('page.ai.config.modelType'),
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: 'deepseek-v4-flash / deepseek-v4-pro',
      },
      fieldName: 'modelName',
      label: $t('page.ai.config.modelName'),
      rules: 'required',
    },
    {
      component: 'InputPassword',
      fieldName: 'apiKey',
      help: $t('page.ai.config.apiKeyTip'),
      label: $t('page.ai.config.apiKey'),
    },
    {
      component: 'Input',
      fieldName: 'baseUrl',
      label: $t('page.ai.config.baseUrl'),
    },
    {
      component: 'Textarea',
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
      label: $t('page.ai.config.name'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          {
            label: $t('page.ai.config.providerOptions.deepseek'),
            value: 'deepseek',
          },
          {
            label: $t('page.ai.config.providerOptions.openai'),
            value: 'openai',
          },
          {
            label: $t('page.ai.config.providerOptions.ollama'),
            value: 'ollama',
          },
          {
            label: $t('page.ai.config.providerOptions.custom'),
            value: 'custom',
          },
        ],
      },
      fieldName: 'provider',
      label: $t('page.ai.config.provider'),
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
      label: $t('page.ai.config.status'),
    },
  ];
}

/** 列定义 */
export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'name', title: $t('page.ai.config.name'), minWidth: 140 },
    {
      field: 'provider',
      title: $t('page.ai.config.provider'),
      minWidth: 110,
      slots: { default: 'provider' },
    },
    { field: 'modelName', title: $t('page.ai.config.model'), minWidth: 150 },
    {
      field: 'baseUrl',
      title: $t('page.ai.config.baseUrl'),
      minWidth: 170,
      showOverflow: true,
    },
    {
      field: 'apiKeyMasked',
      title: $t('page.ai.config.apiKey'),
      minWidth: 130,
    },
    {
      cellRender: { name: 'CellTag' },
      field: 'status',
      title: $t('page.ai.config.status'),
      minWidth: 100,
    },
    {
      field: 'isDefault',
      title: $t('page.ai.config.isDefault'),
      minWidth: 90,
      slots: { default: 'default' },
    },
    {
      align: 'center',
      field: 'operation',
      fixed: 'right',
      slots: { default: 'action' },
      title: $t('common.action'),
      minWidth: 420,
    },
  ];
}

export type ModelConfigRow = AiApi.ModelConfig;
