<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemAppApi } from '#/api/system/app';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteApp,
  getAppList,
  resetAppSecret,
  updateApp,
} from '#/api/system/app';
import { $t } from '#/locales';

import { showSecretOnce } from '../_shared/show-secret';
import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, FormDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: { ajax: { query: async () => await getAppList() } },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemAppApi.AppResp>,
});

function onEdit(row: SystemAppApi.AppResp) {
  FormDrawerApi.setData({ isUpdate: true, row }).open();
}
function onDelete(row: SystemAppApi.AppResp) {
  deleteApp(row.id).then(() => {
    message.success($t('common.success'));
    gridApi.query();
  });
}

function onResetSecret(row: SystemAppApi.AppResp) {
  resetAppSecret(row.id).then((secret) => {
    message.success($t('common.success'));
    showSecretOnce(secret, $t('system.app.secretKey'));
  });
}

function onSecret(secret: string) {
  showSecretOnce(secret, $t('system.app.secretKey'));
}

async function onStatusChange(status: number, row: SystemAppApi.AppResp) {
  try {
    await updateApp(row.id, { ...row, enabled: status });
    message.success($t('common.success'));
    return true;
  } catch {
    return false;
  }
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @reload="gridApi.reload()" @secret="onSecret" />
    <Grid>
      <template #toolbar-tools>
        <Button
          type="primary"
          @click="
            () => {
              FormDrawerApi.setData({ isUpdate: false });
              FormDrawerApi.open();
            }
          "
        >
          <template #icon><Plus /></template>
          {{ $t('common.add') }}
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
                title: $t('ui.actionMessage.deleteConfirm', [
                  row.appName || '',
                ]),
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
