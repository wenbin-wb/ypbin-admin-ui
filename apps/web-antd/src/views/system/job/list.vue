<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemJobApi } from '#/api/system/job';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteJob,
  getJobList,
  runJob,
  startJob,
  stopJob,
} from '#/api/system/job';
import { $t } from '#/locales';

import { useColumns } from './data';
import Form from './modules/form.vue';
import Log from './modules/log.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
});

const [LogDrawer, logDrawerApi] = useVbenDrawer({
  connectedComponent: Log,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: { ajax: { query: async () => await getJobList() } },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemJobApi.JobResp>,
});

function onRefresh() {
  gridApi.query();
}

function onEdit(row: SystemJobApi.JobResp) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData(null).open();
}
function onDelete(row: SystemJobApi.JobResp) {
  deleteJob(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}
function onStart(row: SystemJobApi.JobResp) {
  startJob(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}
function onStop(row: SystemJobApi.JobResp) {
  stopJob(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}
function onRun(row: SystemJobApi.JobResp) {
  runJob(row.id)
    .then(() => {
      message.success($t('common.success'));
    })
    .catch(() => {});
}
function onViewLog(row: SystemJobApi.JobResp) {
  logDrawerApi.setData(row).open();
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @reload="onRefresh" />
    <LogDrawer />
    <Grid :table-title="$t('system.job.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:job:add']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.job.name')]) }}
        </Button>
      </template>

      <template #scheduleRule="{ row }">
        {{
          row.fixedRateSeconds != null
            ? $t('system.job.fixedRateDisplay', [row.fixedRateSeconds])
            : row.cron
        }}
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'system:job:edit',
              onClick: () => onEdit(row),
            },
            {
              text: $t('system.jobLog.title'),
              icon: 'lucide:scroll-text',
              auth: 'system:job:list',
              onClick: () => onViewLog(row),
            },
          ]"
          :dropdown-actions="[
            {
              text: $t('system.job.start'),
              icon: 'lucide:play',
              auth: 'system:job:edit',
              popConfirm: {
                title: $t('system.job.start'),
                confirm: () => onStart(row),
              },
            },
            {
              text: $t('system.job.stop'),
              icon: 'lucide:square',
              auth: 'system:job:edit',
              popConfirm: {
                title: $t('system.job.stop'),
                confirm: () => onStop(row),
              },
            },
            {
              text: $t('system.job.run'),
              icon: 'lucide:rotate-cw',
              auth: 'system:job:edit',
              popConfirm: {
                title: $t('system.job.runOnce'),
                confirm: () => onRun(row),
              },
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'system:job:delete',
              danger: true,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.name || '']),
                confirm: () => onDelete(row),
              },
            },
          ]"
          :more-text="$t('common.more')"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
