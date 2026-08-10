<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemLogApi } from '#/api/system/log';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { getLogList } from '#/api/system/log';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import DetailDrawer from './modules/detail.vue';

const [Detail, drawerApi] = useVbenDrawer({ connectedComponent: DetailDrawer });

const [Grid] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Recordable<any>) =>
          await getLogList({
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
  } as VxeTableGridOptions<SystemLogApi.LogResp>,
});

function onDetail(row: SystemLogApi.LogResp) {
  drawerApi.setData(row);
  drawerApi.open();
}
</script>
<template>
  <Page auto-content-height>
    <Detail />
    <Grid :table-title="$t('system.log.title')">
      <template #toolbar-tools> </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.detail'),
              icon: 'lucide:eye',
              auth: 'system:log:list',
              onClick: () => onDetail(row),
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
