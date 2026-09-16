<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemTrackingApi } from '#/api/system/tracking';

import { ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Download } from '@vben/icons';
import { TRACKING_EVENT_CATALOG } from '@vben/tracking';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { exportTrackEvents, getTrackEventList } from '#/api/system/tracking';
import { $t } from '#/locales';
import { downloadBlobSafe } from '#/utils/file';

import { useColumns, useGridFormSchema } from './data';
import DetailDrawer from './modules/detail.vue';
import { usePageTitle } from './use-page-title';

const [Detail, drawerApi] = useVbenDrawer({ connectedComponent: DetailDrawer });

/** 页面地址 → 菜单标题（映射不到时回退原始地址） */
const { pageTitle } = usePageTitle();

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Recordable<any>) =>
          await getTrackEventList({
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
  } as VxeTableGridOptions<SystemTrackingApi.TrackEvent>,
});

/**
 * 事件码的说明文案。
 *
 * 目录里没有该码时（例如后端已上线新事件但前端未重跑生成器）如实标注，
 * 而不是回退成空串——"这个码没人认识"本身就是需要暴露的信号。
 */
function eventDescription(eventCode: string): string {
  return (
    TRACKING_EVENT_CATALOG[eventCode]?.description ??
    $t('tracking.events.unknownEventCode')
  );
}

function onDetail(row: SystemTrackingApi.TrackEvent) {
  drawerApi.setData(row);
  drawerApi.open();
}

const exportLoading = ref(false);

async function onExport() {
  exportLoading.value = true;
  try {
    // 导出沿用当前筛选条件（与列表同源），否则会导出与屏幕上不一致的数据
    const formValues = gridApi.formApi?.form?.values ?? {};
    const blob = await exportTrackEvents(
      formValues as SystemTrackingApi.TrackEventQuery,
    );
    const downloaded = await downloadBlobSafe(
      blob,
      $t('tracking.events.exportFileName'),
      $t('tracking.events.exportFailed'),
    );
    if (downloaded) {
      message.success($t('common.success'));
    }
  } catch (error) {
    console.error('Failed to export tracking events:', error);
    message.error($t('tracking.events.exportFailed'));
  } finally {
    exportLoading.value = false;
  }
}
</script>

<template>
  <Page auto-content-height>
    <Detail />
    <Grid :table-title="$t('tracking.events.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:track:export']"
          :loading="exportLoading"
          @click="onExport"
        >
          <Download class="mr-1 size-4" />
          {{ $t('tracking.events.export') }}
        </Button>
      </template>

      <template #eventCode="{ row }">
        <div class="flex flex-col">
          <span>{{ row.eventCode }}</span>
          <span class="text-xs text-muted-foreground">
            {{ eventDescription(row.eventCode) }}
          </span>
        </div>
      </template>

      <template #pageUrl="{ row }">
        {{ pageTitle(row.pageUrl) }}
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.detail'),
              icon: 'lucide:eye',
              auth: 'system:track:list',
              onClick: () => onDetail(row),
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
