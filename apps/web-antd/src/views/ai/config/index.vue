<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteModel,
  duplicateModel,
  getModelList,
  setDefaultModel,
  testModel,
  updateModelStatus,
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
          const items = await getModelList();
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
      message.success($t('page.ai.config.testOk', [String(result.latencyMs)]));
    })
    .catch((error: any) => {
      // 显示后端返回的具体失败原因（如 HTTP 401/404、超时等）
      const reason = error?.message || error?.data?.message;
      message.error(reason || $t('page.ai.config.testFail'));
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
    .catch((error: any) => {
      // 显示后端返回的具体失败原因（如默认模型不可删除），不静默吞错
      const reason = error?.message || error?.data?.message;
      message.error(reason || $t('page.ai.config.deleteFail'));
    });
}

function onToggleStatus(row: AiApi.ModelConfig) {
  const target = row.status === 1 ? 0 : 1;
  updateModelStatus(row.id, target)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch((error: any) => {
      const reason = error?.message || error?.data?.message;
      message.error(reason || $t('page.ai.config.deleteFail'));
    });
}

function onDuplicate(row: AiApi.ModelConfig) {
  duplicateModel(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch((error: any) => {
      const reason = error?.message || error?.data?.message;
      message.error(reason || $t('page.ai.config.duplicateFail'));
    });
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
              disabled: row.isDefault === 1,
              tooltip:
                row.isDefault === 1
                  ? $t('page.ai.config.defaultLocked')
                  : undefined,
              onClick: () => onSetDefault(row),
            },
            {
              text:
                row.status === 1
                  ? $t('page.ai.config.disabled')
                  : $t('page.ai.config.enabled'),
              icon: 'lucide:power',
              auth: 'ai:model:edit',
              danger: row.status === 1,
              disabled: row.isDefault === 1 && row.status === 1,
              tooltip:
                row.isDefault === 1 && row.status === 1
                  ? $t('page.ai.config.defaultLocked')
                  : undefined,
              popConfirm:
                row.status === 1
                  ? {
                      title: $t('page.ai.config.confirmDisable'),
                      confirm: () => onToggleStatus(row),
                    }
                  : undefined,
              onClick: row.status === 1 ? undefined : () => onToggleStatus(row),
            },
            {
              text: $t('page.ai.config.duplicate'),
              icon: 'lucide:copy',
              auth: 'ai:model:create',
              onClick: () => onDuplicate(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'ai:model:delete',
              danger: true,
              disabled: row.isDefault === 1,
              tooltip:
                row.isDefault === 1
                  ? $t('page.ai.config.defaultLocked')
                  : undefined,
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
