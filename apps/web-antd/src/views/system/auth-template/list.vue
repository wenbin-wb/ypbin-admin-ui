<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemAuthTemplateApi } from '#/api/system/auth-template';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteAuthTemplate,
  getAuthTemplateList,
} from '#/api/system/auth-template';
import { $t } from '#/locales';

import { useColumns } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: { ajax: { query: async () => await getAuthTemplateList() } },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemAuthTemplateApi.AuthTemplateResp>,
});

function onRefresh() {
  gridApi.query();
}

function onEdit(row: SystemAuthTemplateApi.AuthTemplateResp) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData(null).open();
}
function onDelete(row: SystemAuthTemplateApi.AuthTemplateResp) {
  deleteAuthTemplate(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @reload="onRefresh" />
    <Grid :table-title="$t('system.authTemplate.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:auth-template:add']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.authTemplate.title')]) }}
        </Button>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'system:auth-template:edit',
              onClick: () => onEdit(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'system:auth-template:delete',
              danger: true,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.name || '']),
                confirm: () => onDelete(row),
              },
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
