<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { Page } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAllJobLogList } from '#/api/system/job';
import { $t } from '#/locales';

import { useLogColumns } from '../data';

const [Grid] = useVbenVxeGrid({
  gridOptions: {
    columns: useLogColumns(true),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          return await getAllJobLogList({
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
</script>
<template>
  <Page auto-content-height>
    <Grid :table-title="$t('system.jobLog.title')" />
  </Page>
</template>
