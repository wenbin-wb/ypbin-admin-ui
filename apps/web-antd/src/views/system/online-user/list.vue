<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemOnlineUserApi } from '#/api/system/online-user';

import { Page } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteOnlineUser, getOnlineUserList } from '#/api/system/online-user';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: { ajax: { query: async () => await getOnlineUserList() } },
    rowConfig: { keyField: 'token' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemOnlineUserApi.OnlineUserResp>,
});

function onForceLogout(row: SystemOnlineUserApi.OnlineUserResp) {
  deleteOnlineUser(row.token).then(() => {
    message.success($t('common.success'));
    gridApi.reload();
  });
}
</script>
<template>
  <Page auto-content-height>
    <Grid :table-title="$t('system.onlineUser.title')">
      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('system.onlineUser.forceLogout'),
              icon: 'lucide:log-out',
              danger: true,
              popConfirm: {
                title: $t('system.onlineUser.forceLogout'),
                confirm: () => onForceLogout(row),
              },
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
