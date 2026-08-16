<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteModel,
  listModels,
  setDefaultModel,
  testModel,
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
          const items = await listModels();
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
  } as VxeTableGridOptions<AiApi.ModelConfig>,
});

function onRefresh() {
  gridApi.query();
}

function onEdit(row: AiApi.ModelConfig) {
  formDrawerApi.setData(row).open();
}

function onCreate() {
  formDrawerApi.setData(null).open();
}

function onTest(row: AiApi.ModelConfig) {
  testModel(row.id)
    .then((result) => {
      message.success(
        $t('page.ai.config.testOk').replace('{ms}', String(result.latencyMs)),
      );
    })
    .catch(() => {
      message.error($t('page.ai.config.testFail'));
    });
}

function onSetDefault(row: AiApi.ModelConfig) {
  setDefaultModel(row.id).then(() => {
    message.success($t('common.success'));
    onRefresh();
  });
}

function onDelete(row: AiApi.ModelConfig) {
  deleteModel(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}

const providerTags: Record<string, string> = {
  custom: 'default',
  deepseek: 'blue',
  ollama: 'green',
  openai: 'purple',
};
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @reload="onRefresh" />
    <Grid :table-title="$t('page.ai.config.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['ai:model:create']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('page.ai.config.addModel') }}
        </Button>
      </template>

      <template #provider="{ row }">
        <Tag :color="providerTags[row.provider] ?? 'default'">
          {{ row.provider }}
        </Tag>
      </template>

      <template #default="{ row }">
        <Tag v-if="row.isDefault" color="blue">
          {{ $t('page.ai.config.default') }}
        </Tag>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'ai:model:edit',
              onClick: () => onEdit(row),
            },
            {
              text: $t('page.ai.config.test'),
              icon: 'lucide:plug-zap',
              auth: 'ai:model:list',
              onClick: () => onTest(row),
            },
            {
              text: $t('page.ai.config.setDefault'),
              icon: 'lucide:check-circle',
              auth: 'ai:model:edit',
              ifShow: !row.isDefault,
              onClick: () => onSetDefault(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'ai:model:delete',
              danger: true,
              ifShow: !row.isDefault,
              popConfirm: {
                title: $t('page.ai.config.confirmDelete'),
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
