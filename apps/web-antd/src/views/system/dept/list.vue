<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemDeptApi } from '#/api/system/dept';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteDept, getDeptList } from '#/api/system/dept';
import { $t } from '#/locales';

import { useColumns } from './data';
import Form from './modules/form.vue';

const [FormDrawer, FormDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

/**
 * 编辑部门
 */
function onEdit(row: SystemDeptApi.SystemDept) {
  FormDrawerApi.setData(row).open();
}

/**
 * 添加下级部门
 */
function onAppend(row: SystemDeptApi.SystemDept) {
  FormDrawerApi.setData({ pid: row.id }).open();
}

/**
 * 创建新部门
 */
function onCreate() {
  FormDrawerApi.setData(null).open();
}

/**
 * 删除部门
 */
function onDelete(row: SystemDeptApi.SystemDept) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteDept(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      refreshGrid();
    })
    .catch(() => {
      hideLoading();
    });
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async () => await getDeptList(),
      },
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
    treeConfig: {
      parentField: 'pid',
      rowField: 'id',
      transform: false,
    },
  } as VxeTableGridOptions,
});

function refreshGrid() {
  gridApi.query();
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="refreshGrid" />
    <Grid :table-title="$t('system.dept.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.dept.name')]) }}
        </Button>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              onClick: () => onEdit(row),
            },
            {
              text: $t('common.create'),
              icon: 'lucide:plus',
              onClick: () => onAppend(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              danger: true,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.name]),
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
