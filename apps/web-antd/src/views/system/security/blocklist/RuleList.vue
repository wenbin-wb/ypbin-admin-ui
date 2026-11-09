<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemBlocklistApi } from '#/api/system/blocklist';

import { useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteBlocklist,
  getBlocklistList,
  refreshBlocklist,
} from '#/api/system/blocklist';
import { $t } from '#/locales';

import { matchTypeLabel, useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          await getBlocklistList({
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
  } as VxeTableGridOptions<SystemBlocklistApi.BlocklistResp>,
});

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData(null).open();
}

function onEdit(row: SystemBlocklistApi.BlocklistResp) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: SystemBlocklistApi.BlocklistResp) {
  deleteBlocklist(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}

function onRefreshRules() {
  refreshBlocklist()
    .then(() => {
      message.success($t('system.blocklist.refreshSuccess'));
      onRefresh();
    })
    .catch(() => {});
}
</script>
<template>
  <div class="h-full">
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('system.blocklist.list')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:blocklist:add']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.blocklist.name')]) }}
        </Button>
        <Button
          v-access:code="['system:blocklist:edit']"
          class="ml-2"
          @click="onRefreshRules"
        >
          {{ $t('system.blocklist.refresh') }}
        </Button>
      </template>

      <template #matchType="{ row }">
        {{ matchTypeLabel(row.matchType) }}
      </template>

      <template #expireTime="{ row }">
        {{ row.expireTime || $t('system.blocklist.permanent') }}
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'system:blocklist:edit',
              onClick: () => onEdit(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'system:blocklist:delete',
              danger: true,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.matchValue]),
                confirm: () => onDelete(row),
              },
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </div>
</template>
