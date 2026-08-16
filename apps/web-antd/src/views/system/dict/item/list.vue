<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemDictItemApi } from '#/api/system/dictItem';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteDictItem, getDictItemList } from '#/api/system/dictItem';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const dictId = ref('');

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          if (!dictId.value) return [];
          return await getDictItemList({ dictId: dictId.value });
        },
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
  } as VxeTableGridOptions<SystemDictItemApi.DictItemResp>,
});

interface DictItemListData {
  dictId: string;
  dictName?: string;
}

const [Drawer, drawerApi] = useVbenDrawer<DictItemListData>({
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData();
      if (data?.dictId) {
        dictId.value = data.dictId;
        drawerApi.setState({
          title: `${$t('system.dictItem.title')} - ${data.dictName ?? ''}`,
        });
        gridApi.query();
      }
    }
  },
});

function onEdit(row: SystemDictItemApi.DictItemResp) {
  formDrawerApi
    .setData({
      isUpdate: true,
      row,
      dictId: dictId.value,
    })
    .open();
}

function onCreate() {
  formDrawerApi
    .setData({
      isUpdate: false,
      dictId: dictId.value,
    })
    .open();
}

function onDelete(row: SystemDictItemApi.DictItemResp) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.label]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteDictItem(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.label]),
        key: 'action_process_msg',
      });
      gridApi.query();
    })
    .catch(() => {
      hideLoading();
    });
}

defineExpose({ drawerApi });
</script>

<template>
  <Drawer class="w-[800px]">
    <FormDrawer @reload="gridApi.query()" />
    <Grid>
      <template #toolbar-tools>
        <Button
          v-access:code="['system:dict:add']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.dictItem.name')]) }}
        </Button>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
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
                title: $t('ui.actionMessage.deleteConfirm', [row.label || '']),
                confirm: () => onDelete(row),
              },
            },
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Drawer>
</template>
