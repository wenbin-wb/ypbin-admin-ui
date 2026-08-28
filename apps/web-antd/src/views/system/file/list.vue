<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemFileApi } from '#/api/system/file';

import { Page } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteFile, getFileList } from '#/api/system/file';
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
        query: async ({ page }, form) =>
          await getFileList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...form,
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
  } as VxeTableGridOptions<SystemFileApi.FileResp>,
});
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              danger: true,
              auth: 'system:file:delete',
              popConfirm: {
                title: $t('common.confirmDelete'),
                confirm: async () => {
                  await deleteFile(row.id);
                  message.success($t('common.success'));
                  await gridApi.reload();
                },
              },
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
