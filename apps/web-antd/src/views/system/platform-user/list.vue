<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemPlatformUserApi } from '#/api/system/platform-user';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  getPlatformUserList,
  updatePlatformUserStatus,
} from '#/api/system/platform-user';
import { $t } from '#/locales';

import { useConfirm } from '../_shared/confirm';
import { useColumns, useGridFormSchema } from './data';
import ResetPassword from './modules/reset-password.vue';

const { hasAccessByCodes } = useAccess();
const canEdit = hasAccessByCodes(['system:platform-user:edit']);

const [ResetPasswordModal, resetPasswordApi] = useVbenModal({
  connectedComponent: ResetPassword,
  destroyOnClose: false,
});

async function onStatusChange(
  newStatus: 0 | 1,
  row: SystemPlatformUserApi.PlatformUser,
) {
  const statusText =
    newStatus === 1 ? $t('common.enabled') : $t('common.disabled');
  try {
    await useConfirm(
      $t('system.platformUser.statusChangeContent', [
        row.realName || row.username,
        statusText,
      ]),
      $t('system.platformUser.statusChangeTitle'),
    );
    await updatePlatformUserStatus(row.id, { status: newStatus });
    row.status = newStatus;
    message.success($t('common.success'));
    return true;
  } catch {
    return false;
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(canEdit ? onStatusChange : undefined),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Record<string, any>) =>
          await getPlatformUserList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
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
  } as VxeTableGridOptions<SystemPlatformUserApi.PlatformUser>,
});

function onRefresh() {
  gridApi.query();
}

function onResetPassword(row: SystemPlatformUserApi.PlatformUser) {
  resetPasswordApi
    .setData({ id: row.id, name: row.realName || row.username })
    .open();
}
</script>

<template>
  <Page auto-content-height>
    <ResetPasswordModal @success="onRefresh" />
    <Grid :table-title="$t('system.platformUser.title')">
      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('system.platformUser.resetPassword'),
              icon: 'lucide:key-round',
              auth: 'system:platform-user:reset-password',
              onClick: () => onResetPassword(row),
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
