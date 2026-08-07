<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemJobApi } from '#/api/system/job';

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

const [Drawer, drawerApi] = useVbenDrawer<SystemJobApi.JobResp>({
  footer: false,
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData();
      jobId.value = data?.id ?? '';
      gridApi.query();
    }
  },
});

defineExpose({ drawerApi });
</script>
<template>
  <Drawer class="w-[900px]" :title="$t('system.jobLog.title')">
    <Grid />
  </Drawer>
</template>
