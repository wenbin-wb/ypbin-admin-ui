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
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          await getOnlineUserList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
      },
    },
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

/** 强退后刷新列表：沿用列表页既有约定用 `query`（保持当前页码），不跳回第一页。 */
function onRefresh() {
  gridApi.query();
}

function onForceLogout(row: SystemOnlineUserApi.OnlineUserResp) {
  deleteOnlineUser(row.token)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    // 失败提示由全局请求拦截器统一处理，这里仅兜底避免未处理拒绝
    .catch(() => {});
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
              auth: 'system:online-user:kickout',
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
