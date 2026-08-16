<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteKnowledgeBase, getKnowledgeBaseList } from '#/api/ai';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Documents from './modules/documents.vue';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [DocumentsDrawer, documentsDrawerApi] = useVbenDrawer({
  connectedComponent: Documents,
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
          const items = await getKnowledgeBaseList();
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
  } as VxeTableGridOptions<AiApi.KnowledgeBase>,
});

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData(null).open();
}

function onManageDocs(row: AiApi.KnowledgeBase) {
  documentsDrawerApi.setData(row).open();
}

function onDelete(row: AiApi.KnowledgeBase) {
  deleteKnowledgeBase(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @reload="onRefresh" />
    <DocumentsDrawer @reload="onRefresh" />
    <Grid :table-title="$t('page.ai.knowledge.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['ai:knowledge:create']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('page.ai.knowledge.create') }}
        </Button>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('page.ai.knowledge.manageDocs'),
              icon: 'lucide:folder-open',
              auth: 'ai:knowledge:list',
              onClick: () => onManageDocs(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'ai:knowledge:delete',
              danger: true,
              popConfirm: {
                title: $t('page.ai.knowledge.confirmDeleteKb'),
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
