<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deletePromptTemplate,
  getPromptTemplateList,
  togglePromptTemplate,
} from '#/api/ai';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          const items = await getPromptTemplateList();
          return { items, total: items.length };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<AiApi.PromptTemplate>,
});

function onRefresh() {
  gridApi.query();
}

function onEdit(row: AiApi.PromptTemplate) {
  formDrawerApi.setData(row).open();
}

function onCreate() {
  formDrawerApi.setData(null).open();
}

function onToggle(row: AiApi.PromptTemplate) {
  togglePromptTemplate(row.id, row.status === 1 ? 0 : 1).then(
    () => {
      message.success($t('common.success'));
      onRefresh();
    },
    (error) => {
      console.error('Failed to toggle prompt template:', error);
      message.error($t('common.requestFailed'));
    },
  );
}

function onDelete(row: AiApi.PromptTemplate) {
  deletePromptTemplate(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch((error) => {
      console.error('Failed to delete prompt template:', error);
      message.error($t('common.requestFailed'));
    });
}

function categoryLabel(val?: string) {
  const map: Record<string, string> = {
    analysis: $t('page.ai.prompt.categoryAnalysis'),
    coding: $t('page.ai.prompt.categoryCoding'),
    other: $t('page.ai.prompt.categoryOther'),
    qa: $t('page.ai.prompt.categoryQa'),
    translation: $t('page.ai.prompt.categoryTranslation'),
    writing: $t('page.ai.prompt.categoryWriting'),
  };
  return (val && map[val]) || val || '-';
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @reload="onRefresh" />
    <Grid :table-title="$t('page.ai.prompt.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['ai:prompt:create']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('page.ai.prompt.create') }}
        </Button>
      </template>

      <template #category="{ row }">
        {{ categoryLabel(row.category) }}
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'ai:prompt:edit',
              onClick: () => onEdit(row),
            },
            {
              text:
                row.status === 1
                  ? $t('page.ai.prompt.disabled')
                  : $t('page.ai.prompt.enabled'),
              icon: row.status === 1 ? 'lucide:power' : 'lucide:power-off',
              auth: 'ai:prompt:edit',
              onClick: () => onToggle(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              danger: true,
              auth: 'ai:prompt:delete',
              popConfirm: {
                title: $t('page.ai.prompt.confirmDelete'),
                confirm: () => onDelete(row),
              },
            },
          ]"
          :more-text="$t('common.more')"
        />
      </template>
    </Grid>
  </Page>
</template>
