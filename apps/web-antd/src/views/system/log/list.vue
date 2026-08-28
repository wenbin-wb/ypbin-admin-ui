<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemLogApi } from '#/api/system/log';

import { ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Download } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { exportLogs, getLogList } from '#/api/system/log';
import { $t } from '#/locales';
import { downloadByBlob } from '#/utils/file';

import { useColumns, useGridFormSchema } from './data';
import DetailDrawer from './modules/detail.vue';

const [Detail, drawerApi] = useVbenDrawer({ connectedComponent: DetailDrawer });

const [Grid, gridApi] = useVbenVxeGrid({
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

const exportLoading = ref(false);

async function onExport() {
  exportLoading.value = true;
  try {
    const formValues = gridApi.formApi?.form?.values ?? {};
    const blob = await exportLogs(formValues as any);
    downloadByBlob(
      blob as Blob,
      $t('system.log.exportFileName') || '操作日志.xlsx',
    );
    message.success($t('common.success'));
  } catch (error) {
    console.error('Failed to export logs:', error);
    message.error(
      $t('system.log.exportFailed') || $t('system.user.exportFailed'),
    );
  } finally {
    exportLoading.value = false;
  }
}
</script>

<template>
  <Page auto-content-height>
    <Detail />
    <Grid :table-title="$t('system.log.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:log:list']"
          :loading="exportLoading"
          @click="onExport"
        >
          <Download class="mr-1 size-4" />
          {{ $t('system.user.export') }}
        </Button>
      </template>

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
