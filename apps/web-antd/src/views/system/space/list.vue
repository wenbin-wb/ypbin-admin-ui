<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemSpaceApi } from '#/api/system/space';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteSpace,
  getSpaceDetail,
  getSpaceLazyTree,
} from '#/api/system/space';
import { $t } from '#/locales';

import { toLazyRow } from '../_shared/space-tree';
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
 * 编辑空间。
 *
 * **必须按 ID 拉一次完整详情**：懒加载树节点只带渲染树所需的精简字段
 * （没有地址/经纬度/面积/容量/负责人/扩展 JSON 等）。若直接把节点当表单数据，
 * 那些字段在抽屉里会是空的，用户一保存就把库里已有的值**清空**（`updateStrategy=ALWAYS`）。
 * 这是一个「看起来能编辑、实际会丢数据」的陷阱，必须在打开前补齐。
 */
async function onEdit(row: SystemSpaceApi.SpaceTreeNode) {
  const detail = await getSpaceDetail(row.id);
  FormDrawerApi.setData(detail).open();
}

/**
 * 添加下级空间
 */
function onAppend(row: SystemSpaceApi.SpaceTreeNode) {
  // 新建下级只需 pid，不需要拉详情
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
function onRelation(row: SystemSpaceApi.SpaceTreeNode) {
  relationDrawerApi.setData({ spaceId: row.id, spacePath: row.name }).open();
}

/**
 * 删除空间
 *
 * 后端会在「有子空间」或「仍挂着业务对象」时拒绝，并把原因原样返回——
 * 这里必须把 **后端文案** 展示出来（而不是笼统「删除失败」），
 * 否则用户不知道是该先删子空间还是先解绑。
 */
function onDelete(row: SystemSpaceApi.SpaceTreeNode) {
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
        query: async () => {
          // 懒加载：首屏只查**根层**，子层由 treeConfig.loadMethod 在展开时按需加载。
          // 全量树在万级空间下响应会到 MB 级、且前端递归渲染卡顿；
          // 懒加载每层一次请求（每层几十条），交互与请求量都可控。
          const roots = await getSpaceLazyTree();
          return (roots ?? []).map((node) => toLazyRow(node));
        },
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
      // 懒加载：`loadMethod` 在用户展开某节点时调用，返回该节点的**直接子节点**。
      // vxe 4.20 的契约：loadMethod({ $table, row }) => 子节点数组。
      lazy: true,
      // hasChild 字段告诉 vxe「这个节点要不要显示展开箭头」——没有它只能渲染成叶子，
      // 用户点开才知道有下一层（箭头闪烁/缺失）。
      hasChild: 'hasChildren',
      loadMethod: async ({ row }: { row: SystemSpaceApi.SpaceTreeNode }) => {
        const children = await getSpaceLazyTree({ parentId: row.id });
        return (children ?? []).map((node) => toLazyRow(node));
      },
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
