<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemDictApi } from '#/api/system/dict';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteDict, getDictList } from '#/api/system/dict';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import DictItemDrawer from './item/list.vue';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [ItemDrawer, itemDrawerApi] = useVbenDrawer({
  connectedComponent: DictItemDrawer,
  destroyOnClose: false,
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
          await getDictList({
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
  } as VxeTableGridOptions<SystemDictApi.DictResp>,
});

function onRefresh() {
  gridApi.query();
}

function onEdit(row: SystemDictApi.DictResp) {
  formDrawerApi.setData(row).open();
}

function onItems(row: SystemDictApi.DictResp) {
  itemDrawerApi.setData({ dictId: row.id, dictName: row.name }).open();
}

function onCreate() {
  formDrawerApi.setData(null).open();
}

function onDelete(row: SystemDictApi.DictResp) {
  deleteDict(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch((error) => {
      console.error('Failed to delete dict:', error);
      message.error($t('common.requestFailed'));
    });
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <ItemDrawer />
    <Grid :table-title="$t('system.dict.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:dict:add']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.dict.name')]) }}
        </Button>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('system.dictItem.title'),
              icon: 'lucide:list',
              auth: 'system:dict:list',
              onClick: () => onItems(row),
            },
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'system:dict:edit',
              onClick: () => onEdit(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'system:dict:delete',
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
