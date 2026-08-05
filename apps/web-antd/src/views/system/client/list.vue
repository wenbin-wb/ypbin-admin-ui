<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemClientApi } from '#/api/system/client';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteClient,
  getClientList,
  resetClientSecret,
} from '#/api/system/client';
import { $t } from '#/locales';

import { showSecretOnce } from '../_shared/show-secret';
import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: { ajax: { query: async () => await getClientList() } },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemClientApi.ClientResp>,
});

function onRefresh() {
  gridApi.query();
}

function onEdit(row: SystemClientApi.ClientResp) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onDelete(row: SystemClientApi.ClientResp) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.clientId]),
    duration: 0,
    key: 'del',
  });
  deleteClient(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.clientId]),
        key: 'del',
      });
      onRefresh();
    })
    .catch(() => hideLoading());
}

function onResetSecret(row: SystemClientApi.ClientResp) {
  resetClientSecret(row.id).then((secret) => {
    message.success($t('common.success'));
    showSecretOnce(secret, $t('system.client.clientSecret'));
  });
}

function onSecret(secret: string) {
  showSecretOnce(secret, $t('system.client.clientSecret'));
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @secret="onSecret" @success="onRefresh" />
    <Grid :table-title="$t('system.client.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.client.title')]) }}
        </Button>
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
              text: $t('system.common.resetSecret'),
              icon: 'lucide:key-round',
              popConfirm: {
                title: $t('system.common.resetSecretConfirm'),
                confirm: () => onResetSecret(row),
              },
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              danger: true,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.clientId]),
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
