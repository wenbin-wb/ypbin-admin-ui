<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemPostApi } from '#/api/system/post';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { deletePost, getPostList } from '#/api/system/post';
import { getRelationsByTargets } from '#/api/system/space';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

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
          const rows = await getPostList();
          // 列表页「工作地点」列：**一次批量反查**，不逐行调（那是 N 次 HTTP）。
          // 反查失败不阻断列表：该列退化为空并给出可见提示，而不是整页报错（岗位数据本身有效）。
          try {
            const ids = (rows ?? []).map((row) => row.id);
            const grouped = await getRelationsByTargets('post', ids);
            for (const row of rows ?? []) {
              const list = grouped[row.id] ?? [];
              // 主空间优先展示，其余用「+N」表示，避免列被多条路径撑爆
              const primary =
                list.find((item) => item.isPrimary === 1) ?? list[0];
              row.spaceText = primary
                ? `${primary.spacePath || primary.spaceName}${list.length > 1 ? ` +${list.length - 1}` : ''}`
                : '';
            }
          } catch {
            message.warning($t('system.space.relationLoadFailed'));
          }
          return rows;
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
  } as VxeTableGridOptions<SystemPostApi.PostResp>,
});

function onEdit(row: SystemPostApi.PostResp) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: SystemPostApi.PostResp) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
    key: 'action_process_msg',
  });
  deletePost(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.name]),
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function onRefresh() {
  gridApi.query();
}
function onCreate() {
  formDrawerApi.setData(null).open();
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('system.post.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:post:add']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.post.name')]) }}
        </Button>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'system:post:edit',
              onClick: () => onEdit(row),
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              auth: 'system:post:delete',
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
