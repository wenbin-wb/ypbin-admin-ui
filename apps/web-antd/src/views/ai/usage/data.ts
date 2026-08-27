import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

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
