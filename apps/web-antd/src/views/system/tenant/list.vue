<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemTenantApi } from '#/api/system/tenant';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteTenant, getTenantList } from '#/api/system/tenant';
import { $t } from '#/locales';

import { useColumns } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: { ajax: { query: async () => await getTenantList() } },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemTenantApi.TenantResp>,
});

function onRefresh() {
  gridApi.query();
}

function onEdit(row: SystemTenantApi.TenantResp) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData(null).open();
}
function onDelete(row: SystemTenantApi.TenantResp) {
  deleteTenant(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch((error) => {
      console.error('Failed to delete tenant:', error);
      message.error($t('common.requestFailed'));
    });
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @reload="onRefresh" />
    <Grid :table-title="$t('system.tenant.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:tenant:add']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.tenant.title')]) }}
        </Button>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'system:tenant:edit',
              onClick: () => onEdit(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'system:tenant:delete',
              danger: true,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.name || '']),
                confirm: () => onDelete(row),
              },
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
