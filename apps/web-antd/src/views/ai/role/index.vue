<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteRole, getRoleList, toggleRoleFavorite } from '#/api/ai';
import { $t } from '#/locales';
import { roleBadge } from '#/views/ai/_shared/role-badge';
import '#/views/ai/_shared/role-badge.css';

import { useColumns } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async () => {
          const items = await getRoleList();
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
  } as VxeTableGridOptions,
});

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData(null).open();
}

function onEdit(row: any) {
  formDrawerApi.setData(row).open();
}

async function onDelete(row: any) {
  await deleteRole(row.id);
  message.success($t('common.success'));
  onRefresh();
}

async function onToggleFavorite(row: any) {
  await toggleRoleFavorite(row.id);
  message.success($t('common.success'));
  onRefresh();
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @reload="onRefresh" />
    <Grid :table-title="$t('page.ai.role.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['ai:role:create']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('page.ai.role.create') }}
        </Button>
      </template>

      <template #emoji="{ row }">
        <span class="ym-badge" :class="roleBadge(row.category).cls">{{
          roleBadge(row.category).char
        }}</span>
      </template>

      <template #builtin="{ row }">
        <Tag v-if="row.isBuiltin === 1" color="blue">
          {{ $t('page.ai.role.isBuiltin') }}
        </Tag>
        <Tag v-else>{{ $t('page.ai.role.category_custom') }}</Tag>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'ai:role:edit',
              disabled: row.isBuiltin === 1,
              tooltip:
                row.isBuiltin === 1 ? $t('page.ai.role.isBuiltin') : undefined,
              onClick: () => onEdit(row),
            },
            {
              text: row.isFavorite
                ? $t('page.ai.chat.roleFavorite')
                : $t('page.ai.chat.roleAll'),
              icon: 'lucide:star',
              onClick: () => onToggleFavorite(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'ai:role:delete',
              danger: true,
              disabled: row.isBuiltin === 1,
              tooltip:
                row.isBuiltin === 1 ? $t('page.ai.role.isBuiltin') : undefined,
              popConfirm: {
                title: $t('page.ai.role.confirmDelete'),
                confirm: () => onDelete(row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
