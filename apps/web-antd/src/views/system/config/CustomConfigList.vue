<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemConfigApi } from '#/api/system/config';

import { useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteConfig, getConfigList } from '#/api/system/config';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Recordable<any>) =>
          await getConfigList({
            page: page.currentPage,
            pageSize: page.pageSize,
            builtIn: 0,
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
  } as VxeTableGridOptions<SystemConfigApi.ConfigResp>,
});

function onRefresh() {
  gridApi.query();
}

function onEdit(row: SystemConfigApi.ConfigResp) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData(null).open();
}
function onDelete(row: SystemConfigApi.ConfigResp) {
  deleteConfig(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}
</script>
<template>
  <FormDrawer @success="onRefresh" />
  <Grid :table-title="$t('system.config.customTitle')">
    <template #toolbar-tools>
      <Button
        v-access:code="['system:config:add']"
        type="primary"
        @click="onCreate"
      >
        <Plus class="size-5" />
        {{ $t('ui.actionTitle.create', [$t('system.config.customTitle')]) }}
      </Button>
    </template>

    <template #action="{ row }">
      <VbenTableAction
        :actions="[
          {
            text: $t('common.edit'),
            icon: 'lucide:edit',
            auth: 'system:config:edit',
            onClick: () => onEdit(row),
          },
          {
            text: $t('common.delete'),
            icon: 'lucide:trash-2',
            auth: 'system:config:delete',
            danger: true,
            popConfirm: {
              title: $t('ui.actionMessage.deleteConfirm', [row.configKey]),
              confirm: () => onDelete(row),
            },
          },
        ]"
        align="center"
      />
    </template>
  </Grid>
</template>
