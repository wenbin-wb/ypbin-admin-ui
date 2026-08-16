import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

/** 每日用量列定义 */
export function useDailyColumns(): VxeTableGridColumns {
  return [
    { field: 'date', title: $t('page.ai.usage.date'), minWidth: 140 },
    {
      field: 'tokens',
      title: $t('page.ai.usage.tokens'),
      minWidth: 180,
      slots: { default: 'dailyTokens' },
    },
  ];
}

/** 按模型分布列定义 */
export function useModelColumns(): VxeTableGridColumns {
  return [
    { field: 'model', title: $t('page.ai.usage.model'), minWidth: 160 },
    {
      field: 'tokens',
      title: $t('page.ai.usage.tokens'),
      minWidth: 140,
      slots: { default: 'modelTokens' },
    },
    {
      field: 'percent',
      title: $t('page.ai.usage.percent'),
      minWidth: 180,
      slots: { default: 'percent' },
    },
  ];
}
