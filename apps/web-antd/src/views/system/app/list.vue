<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemAppApi } from '#/api/system/app';

import { useAccess } from '@vben/access';
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
import { useColumns } from './data';
import Form from './modules/form.vue';

const { hasAccessByCodes } = useAccess();
const canEdit = hasAccessByCodes(['system:app:edit']);

const [FormDrawer, FormDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(canEdit ? onStatusChange : undefined),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: { ajax: { query: async () => await getAppList() } },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemAppApi.AppResp>,
});

function onEdit(row: SystemAppApi.AppResp) {
  FormDrawerApi.setData(row).open();
}
function onDelete(row: SystemAppApi.AppResp) {
  deleteApp(row.id).then(() => {
    message.success($t('common.success'));
    gridApi.query();
  });
}

function onResetSecret(row: SystemAppApi.AppResp) {
  resetAppSecret(row.id).then((credential) => {
    message.success($t('common.success'));
    showSecretOnce(credential.secretKey, $t('system.app.secretKey'));
  });
}

function onSecret(secret: string) {
  showSecretOnce(secret, $t('system.app.secretKey'));
}

async function onStatusChange(
  status: number,
  row: SystemAppApi.AppResp,
): Promise<boolean> {
  try {
    const data: SystemAppApi.AppSaveReq = {
      appName: row.appName,
      enabled: status,
      expireTime: row.expireTime,
    };
    await updateApp(row.id, data);
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
          v-access:code="['system:app:add']"
          type="primary"
          @click="FormDrawerApi.setData(null).open()"
        >
          <template #icon><Plus /></template>
          {{ $t('ui.actionTitle.create', [$t('system.app.title')]) }}
        </Button>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'system:app:edit',
              onClick: () => onEdit(row),
            },
            {
              text: $t('system.common.resetSecret'),
              icon: 'lucide:key-round',
              auth: 'system:app:reset-secret',
              popConfirm: {
                title: $t('system.common.resetSecretConfirm'),
                confirm: () => onResetSecret(row),
              },
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'system:app:delete',
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
