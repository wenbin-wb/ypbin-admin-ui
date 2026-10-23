<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemSpaceApi } from '#/api/system/space';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deleteSpace, getSpaceTree } from '#/api/system/space';
import { $t } from '#/locales';

import { useColumns } from './data';
import Form from './modules/form.vue';
import RelationDrawer from './modules/relation-drawer.vue';

const [FormDrawer, FormDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [RelationDrawerComp, relationDrawerApi] = useVbenDrawer({
  connectedComponent: RelationDrawer,
  destroyOnClose: true,
});

/**
 * 编辑空间
 */
function onEdit(row: SystemSpaceApi.SpaceResp) {
  FormDrawerApi.setData(row).open();
}

/**
 * 添加下级空间
 */
function onAppend(row: SystemSpaceApi.SpaceResp) {
  FormDrawerApi.setData({ pid: row.id }).open();
}

/**
 * 创建新空间
 */
function onCreate() {
  FormDrawerApi.setData(null).open();
}

/**
 * 管理该空间上挂的业务对象
 */
function onRelation(row: SystemSpaceApi.SpaceResp) {
  relationDrawerApi.setData({ spaceId: row.id, spacePath: row.name }).open();
}

/**
 * 删除空间
 *
 * 后端会在「有子空间」或「仍挂着业务对象」时拒绝，并把原因原样返回——
 * 这里必须把 **后端文案** 展示出来（而不是笼统「删除失败」），
 * 否则用户不知道是该先删子空间还是先解绑。
 */
function onDelete(row: SystemSpaceApi.SpaceResp) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteSpace(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      refreshGrid();
    })
    .catch((error: any) => {
      hideLoading();
      message.error(error?.message ?? $t('ui.actionMessage.operationFailed'));
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
        query: async () => await getSpaceTree(),
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
    <RelationDrawerComp @success="refreshGrid" />
    <Grid :table-title="$t('system.space.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:space:add']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.space.name')]) }}
        </Button>
      </template>

      <template #spaceType="{ row }">
        {{ row.spaceTypeText || row.spaceType }}
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'system:space:edit',
              onClick: () => onEdit(row),
            },
            {
              text: $t('system.space.addChild'),
              icon: 'lucide:plus',
              auth: 'system:space:add',
              onClick: () => onAppend(row),
            },
            {
              text: $t('system.space.manageRelation'),
              icon: 'lucide:link',
              auth: 'system:space:bind',
              onClick: () => onRelation(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'system:space:delete',
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
