<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { computed } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  createModel,
  deleteModel,
  listModels,
  setDefaultModel,
  testModel,
  updateModel,
} from '#/api/ai';
import { $t } from '#/locales';

defineOptions({ name: 'AiConfig' });

// ===== 表单 schema =====
function useFormSchema(): VbenFormSchema[] {
  return [
  {
    component: 'Input',
    componentProps: {
      placeholder: $t('page.ai.config.name'),
    },
    fieldName: 'name',
    label: $t('page.ai.config.name'),
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: {
      options: [
        { label: $t('page.ai.config.providerOptions.deepseek'), value: 'deepseek' },
        { label: $t('page.ai.config.providerOptions.openai'), value: 'openai' },
        { label: $t('page.ai.config.providerOptions.ollama'), value: 'ollama' },
        { label: $t('page.ai.config.providerOptions.custom'), value: 'custom' },
      ],
    },
    fieldName: 'provider',
    label: $t('page.ai.config.provider'),
    rules: 'required',
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
    label: $t('page.ai.config.remark'),
  },
];
}

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
});

// ===== 抽屉 =====
const [Drawer, drawerApi] = useVbenDrawer<AiApi.ModelConfig | null>({
  onConfirm: async () => {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues<AiApi.ModelConfigSaveReq>();
    drawerApi.lock();
    const target = drawerApi.getData();
    (target?.id ? updateModel(target.id, values) : createModel(values))
      .then(() => {
        message.success($t('common.success'));
        drawerApi.close();
        gridApi.query();
      })
      .catch(() => drawerApi.unlock());
  },
  onOpenChange: async (isOpen) => {
    if (!isOpen) return;
    formApi.resetForm();
    const data = drawerApi.getData();
    if (data) {
      await formApi.setValues({
        baseUrl: data.baseUrl ?? '',
        modelName: data.modelName,
        name: data.name,
        provider: data.provider,
        remark: data.remark ?? '',
      });
    }
  },
});

const drawerTitle = computed(() => {
  const data = drawerApi.getData();
  return data?.id
    ? $t('page.ai.config.editModel')
    : $t('page.ai.config.addModel');
});

// ===== 表格 =====
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'name', title: $t('page.ai.config.name'), minWidth: 140 },
      {
        field: 'provider',
        title: $t('page.ai.config.provider'),
        width: 110,
        slots: { default: 'provider' },
      },
      { field: 'modelName', title: $t('page.ai.config.model'), minWidth: 140 },
      { field: 'baseUrl', title: $t('page.ai.config.baseUrl'), minWidth: 160 },
      {
        field: 'apiKeyMasked',
        title: $t('page.ai.config.apiKey'),
        width: 130,
      },
      {
        field: 'status',
        title: $t('page.ai.config.status'),
        width: 90,
        slots: { default: 'status' },
      },
      {
        field: 'isDefault',
        title: $t('page.ai.config.isDefault'),
        width: 80,
        slots: { default: 'default' },
      },
      {
        field: 'action',
        title: $t('common.action'),
        width: 230,
        slots: { default: 'action' },
        fixed: 'right',
      },
    ],
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
      zoom: true,
    },
  } as VxeTableGridOptions<AiApi.ModelConfig>,
});

// ===== 操作 =====
function onEdit(row: AiApi.ModelConfig) {
  drawerApi.setData(row).open();
}

function onCreate() {
  drawerApi.setData(null).open();
}

async function onTest(row: AiApi.ModelConfig) {
  try {
    const result = await testModel(row.id);
    message.success(
      $t('page.ai.config.testOk').replace('{ms}', String(result.latencyMs)),
    );
  } catch {
    message.error($t('page.ai.config.testFail'));
  }
}

function onSetDefault(row: AiApi.ModelConfig) {
  setDefaultModel(row.id).then(() => {
    message.success($t('common.success'));
    gridApi.query();
  });
}

function onDelete(row: AiApi.ModelConfig) {
  deleteModel(row.id)
    .then(() => {
      message.success($t('common.success'));
      gridApi.query();
    })
    .catch(() => {});
}
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('page.ai.config.title')">
      <template #toolbar-tools>
        <a-button
          v-access:code="['ai:model:create']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-4" />
          {{ $t('page.ai.config.addModel') }}
        </a-button>
      </template>

      <template #provider="{ row }">
        <a-tag>{{ row.provider }}</a-tag>
      </template>

      <template #status="{ row }">
        <a-badge
          :status="row.status === 1 ? 'success' : 'default'"
          :text="
            row.status === 1
              ? $t('page.ai.config.enabled')
              : $t('page.ai.config.disabled')
          "
        />
      </template>

      <template #default="{ row }">
        <a-tag v-if="row.isDefault" color="blue">
          {{ $t('page.ai.config.default') }}
        </a-tag>
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

    <Drawer :title="drawerTitle" :width="520">
      <Form />
    </Drawer>
  </Page>
</template>
