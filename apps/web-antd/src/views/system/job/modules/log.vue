<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getJobLogList } from '#/api/system/job';
import { $t } from '#/locales';

import { useLogColumns } from '../data';

const jobId = ref('');

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useLogColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          return await getJobLogList(jobId.value, {
            page: page.currentPage,
            pageSize: page.pageSize,
          });
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, zoom: true },
  } as VxeTableGridOptions,
});

const [Drawer, drawerApi] = useVbenDrawer({
  footer: false,
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData<Record<string, any>>();
      jobId.value = data?.id ?? '';
      gridApi.query();
    }
  },
});
</script>
<template>
  <Drawer class="w-[900px]" :title="$t('system.jobLog.title')">
    <Grid />
  </Drawer>
</template>
