<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemBlocklistApi } from '#/api/system/blocklist';

import { message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { getAutoBans, unbanAuto } from '#/api/system/blocklist';
import { $t } from '#/locales';

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        field: 'clientIp',
        title: $t('system.blocklist.clientIp'),
        minWidth: 180,
      },
      {
        field: 'reason',
        title: $t('system.blocklist.reason'),
        minWidth: 220,
      },
      {
        field: 'expireTime',
        title: $t('system.blocklist.expireTime'),
        width: 180,
      },
      {
        title: $t('common.action'),
        field: 'action',
        fixed: 'right',
        width: 120,
        slots: { default: 'action' },
      },
    ],
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => (await getAutoBans()) ?? [],
      },
    },
    rowConfig: { keyField: 'clientIp' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemBlocklistApi.AutoBanResp>,
});

function onRefresh() {
  gridApi.query();
}

function onUnban(row: SystemBlocklistApi.AutoBanResp) {
  unbanAuto(row.clientIp)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}
</script>
<template>
  <div class="h-full">
    <Grid :table-title="$t('system.blocklist.autoBanList')">
      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('system.blocklist.unban'),
              icon: 'lucide:shield-off',
              auth: 'system:blocklist:unban',
              danger: true,
              popConfirm: {
                title: $t('system.blocklist.unbanConfirm', [row.clientIp]),
                confirm: () => onUnban(row),
              },
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </div>
</template>
