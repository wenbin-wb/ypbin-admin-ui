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
  createPromptTemplate,
  deletePromptTemplate,
  listPromptTemplates,
  togglePromptTemplate,
  updatePromptTemplate,
} from '#/api/ai';
import { $t } from '#/locales';

defineOptions({ name: 'AiPrompt' });

const categoryOptions = computed(() => [
  { label: $t('page.ai.prompt.categoryCoding'), value: 'coding' },
  { label: $t('page.ai.prompt.categoryWriting'), value: 'writing' },
  { label: $t('page.ai.prompt.categoryAnalysis'), value: 'analysis' },
  { label: $t('page.ai.prompt.categoryTranslation'), value: 'translation' },
  { label: $t('page.ai.prompt.categoryQa'), value: 'qa' },
  { label: $t('page.ai.prompt.categoryOther'), value: 'other' },
]);

// ===== 表单 =====
function useFormSchema(): VbenFormSchema[] {
  return [
  {
    component: 'Input',
    fieldName: 'name',
    label: $t('page.ai.prompt.name'),
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: { options: categoryOptions.value, allowClear: true },
    fieldName: 'category',
    label: $t('page.ai.prompt.category'),
  },
  {
    component: 'Textarea',
    componentProps: { rows: 8 },
    fieldName: 'template',
    help: $t('page.ai.prompt.placeholderDetail'),
    label: $t('page.ai.prompt.template'),
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'description',
    label: $t('page.ai.prompt.description'),
  },
];
}

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useFormSchema(),
  showDefaultActions: false,
});

// ===== 抽屉 =====
const [Drawer, drawerApi] = useVbenDrawer<AiApi.PromptTemplate | null>({
  onConfirm: async () => {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues<AiApi.PromptTemplateSaveReq>();
    drawerApi.lock();
    const target = drawerApi.getData();
    (target?.id
      ? updatePromptTemplate(target.id, values)
      : createPromptTemplate(values)
    )
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
      await formApi.setValues(data);
    }
  },
});

const drawerTitle = computed(() => {
  const data = drawerApi.getData();
  return data?.id
    ? $t('page.ai.prompt.edit')
    : $t('page.ai.prompt.create');
});

// ===== 表格 =====
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      { field: 'name', title: $t('page.ai.prompt.name'), minWidth: 160 },
      {
        field: 'category',
        title: $t('page.ai.prompt.category'),
        width: 110,
        slots: { default: 'category' },
      },
      {
        field: 'description',
        title: $t('page.ai.prompt.description'),
        minWidth: 220,
        showOverflow: true,
      },
      {
        field: 'status',
        title: $t('page.ai.prompt.status'),
        width: 90,
        slots: { default: 'status' },
      },
      {
        field: 'createTime',
        title: $t('common.createTime'),
        width: 170,
      },
      {
        field: 'action',
        title: $t('common.action'),
        width: 150,
        slots: { default: 'action' },
        fixed: 'right',
      },
    ],
    proxyConfig: {
      ajax: {
        query: async () => {
          const items = await listPromptTemplates();
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
  } as VxeTableGridOptions<AiApi.PromptTemplate>,
});

// ===== 操作 =====
function onCreate() {
  drawerApi.setData(null).open();
}

function onEdit(row: AiApi.PromptTemplate) {
  drawerApi.setData(row).open();
}

function onToggle(row: AiApi.PromptTemplate) {
  const target = row.status === 1 ? 0 : 1;
  togglePromptTemplate(row.id, target).then(() => {
    message.success($t('common.success'));
    gridApi.query();
  });
}

function onDelete(row: AiApi.PromptTemplate) {
  deletePromptTemplate(row.id)
    .then(() => {
      message.success($t('common.success'));
      gridApi.query();
    })
    .catch(() => {});
}

function categoryLabel(val?: string) {
  return (
    categoryOptions.value.find((o) => o.value === val)?.label ?? val ?? '-'
  );
}
</script>

<template>
  <Page auto-content-height>
    <Grid :table-title="$t('page.ai.prompt.title')">
      <template #toolbar-tools>
        <a-button type="primary" @click="onCreate">
          <Plus class="size-4" />
          {{ $t('page.ai.prompt.create') }}
        </a-button>
      </template>

      <template #category="{ row }">
        {{ categoryLabel(row.category) }}
      </template>

      <template #status="{ row }">
        <a-badge
          :status="row.status === 1 ? 'success' : 'default'"
          :text="
            row.status === 1
              ? $t('page.ai.prompt.enabled')
              : $t('page.ai.prompt.disabled')
          "
        />
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              onClick: () => onEdit(row),
            },
            {
              text:
                row.status === 1
                  ? $t('page.ai.prompt.disabled')
                  : $t('page.ai.prompt.enabled'),
              icon: row.status === 1 ? 'lucide:power' : 'lucide:power-off',
              onClick: () => onToggle(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              danger: true,
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

    <Drawer :title="drawerTitle" :width="560">
      <Form />
    </Drawer>
  </Page>
</template>
