<script lang="ts" setup>
import type {
  TrackingEventCatalogItem,
  TrackingEventProperty,
} from '@vben/tracking';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { Page } from '@vben/common-ui';
import { TRACKING_EVENT_CATALOG } from '@vben/tracking';

import { Descriptions, DescriptionsItem } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { $t } from '#/locales';

/** 目录行：事件条目 + 属性数（属性数让"白名单规模"在收起状态也能一眼看到） */
interface CatalogRow extends TrackingEventCatalogItem {
  propertyCount: number;
}

/**
 * 事件目录是**纯前端数据**，直接取自 `@vben/tracking` 的生成物
 * （事实源是 starter 的 `docs/tracking-events.json`），刻意不新增后端接口：
 * 目录变更走"starter 事实源 → 重跑生成器"这条既有链路，多一个接口只会多一处漂移点。
 */
const rows: CatalogRow[] = Object.values(TRACKING_EVENT_CATALOG).map(
  (event) => ({
    ...event,
    propertyCount: event.properties.length,
  }),
);

/** 来源文案：目录里出现未知来源（starter 新增）时回退为原值，而不是显示空 */
const SOURCE_LABEL_KEYS: Record<string, string> = {
  backend: 'tracking.catalog.sourceBackend',
  iot: 'tracking.catalog.sourceIot',
  web: 'tracking.catalog.sourceWeb',
};

function sourceText(source: string): string {
  const labelKey = SOURCE_LABEL_KEYS[source];
  return labelKey ? $t(labelKey) : source;
}

/** 最大长度：数值型属性没有长度概念，字符串属性未声明上限即"不限" */
function maxLengthText(property: TrackingEventProperty): string {
  if (typeof property.maxLength === 'number') {
    return String(property.maxLength);
  }
  return property.type === 'string'
    ? $t('tracking.catalog.maxLengthUnlimited')
    : '-';
}

/** 是否必填：三态展示——目录当前未声明 required，不能把"未声明"说成"选填" */
function requiredText(property: TrackingEventProperty): string {
  if (property.required === true) {
    return $t('tracking.catalog.required');
  }
  if (property.required === false) {
    return $t('tracking.catalog.optional');
  }
  return $t('tracking.catalog.requiredUndeclared');
}

const [Grid] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { type: 'expand', width: 50, slots: { content: 'expandContent' } },
      { field: 'code', title: $t('tracking.catalog.code'), minWidth: 180 },
      {
        field: 'description',
        title: $t('tracking.catalog.description'),
        minWidth: 280,
        showOverflow: true,
      },
      {
        field: 'source',
        title: $t('tracking.catalog.source'),
        width: 120,
        formatter: ({ cellValue }) => sourceText(cellValue),
      },
      { field: 'since', title: $t('tracking.catalog.since'), width: 110 },
      {
        field: 'propertyCount',
        title: $t('tracking.catalog.propertyCount'),
        width: 100,
      },
    ],
    data: rows,
    pagerConfig: { enabled: false },
    rowConfig: { keyField: 'code' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: false,
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<CatalogRow>,
});
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('tracking.catalog.title')">
      <template #expandContent="{ row }">
        <div class="p-2">
          <div
            v-if="row.properties.length === 0"
            class="text-sm text-gray-500 dark:text-gray-400"
          >
            {{ $t('tracking.catalog.noProperty') }}
          </div>
          <Descriptions v-else bordered size="small" :column="1">
            <template v-for="property in row.properties" :key="property.name">
              <DescriptionsItem :label="$t('tracking.catalog.propertyName')">
                {{ property.name }}
              </DescriptionsItem>
              <DescriptionsItem :label="$t('tracking.catalog.propertyType')">
                {{ property.type }}
              </DescriptionsItem>
              <DescriptionsItem
                :label="$t('tracking.catalog.propertyMaxLength')"
              >
                {{ maxLengthText(property) }}
              </DescriptionsItem>
              <DescriptionsItem
                :label="$t('tracking.catalog.propertyRequired')"
              >
                {{ requiredText(property) }}
              </DescriptionsItem>
              <DescriptionsItem
                :label="$t('tracking.catalog.propertyDescription')"
              >
                {{ property.description }}
              </DescriptionsItem>
            </template>
          </Descriptions>
        </div>
      </template>
    </Grid>
  </Page>
</template>
