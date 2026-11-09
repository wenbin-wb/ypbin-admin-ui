<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemBlocklistApi } from '#/api/system/blocklist';

import { useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { getAutoBans, unbanAuto } from '#/api/system/blocklist';
import { $t } from '#/locales';

import { useAutoBanColumns } from './data';
import BanForm from './modules/ban-form.vue';

const [BanModal, banModalApi] = useVbenModal({
  connectedComponent: BanForm,
  destroyOnClose: false,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useAutoBanColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => await getAutoBans(),
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

function onBan() {
  banModalApi.open();
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
    <BanModal @success="onRefresh" />
    <Grid :table-title="$t('system.blocklist.autoBanList')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:blocklist:ban']"
          type="primary"
          @click="onBan"
        >
          <Plus class="size-5" />
          {{ $t('system.blocklist.ban') }}
        </Button>
      </template>

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
