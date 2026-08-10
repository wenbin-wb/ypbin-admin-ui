<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemMessageApi } from '#/api/system/message';

import { h, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, message, Tabs, Tag } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { $t } from '#/locales';
import { useMessageStore } from '#/store';
import MessagePreview from '#/views/system/_shared/message-preview.vue';

const messageStore = useMessageStore();

// 类型 tab：空=全部、1=系统通知、2=用户消息
const activeType = ref<string>('');

// 消息详情（复用通用富文本预览组件）
const previewVisible = ref(false);
const previewData = ref<SystemMessageApi.MessageItem>();

function showDetail(row: SystemMessageApi.MessageItem) {
  if (row.readStatus === 0) {
    void messageStore.markRead(row.id).then(() => gridApi.query());
  }
  previewData.value = row;
  previewVisible.value = true;
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: [
      {
        component: 'Select',
        fieldName: 'readStatus',
        label: $t('system.message.readStatus'),
        componentProps: {
          allowClear: true,
          options: [
            { label: $t('system.message.unread'), value: 0 },
            { label: $t('system.message.read'), value: 1 },
          ],
        },
      },
    ],
    submitOnChange: true,
  },
  gridOptions: {
    columns: [
      { field: 'title', title: $t('system.message.msgTitle'), minWidth: 120 },
      {
        field: 'content',
        title: $t('system.message.content'),
        minWidth: 320,
        slots: {
          default: ({ row }) => {
            const text = row.content
              ? `${row.content}`.replaceAll(/<[^>]+>/g, '').trim()
              : '';
            return text.length > 60 ? `${text.slice(0, 60)}...` : text;
          },
        },
      },
      {
        field: 'readStatus',
        title: $t('system.message.readStatus'),
        width: 100,
        slots: {
          default: ({ row }) =>
            h(
              Tag,
              { color: row.readStatus === 1 ? 'default' : 'processing' },
              () =>
                row.readStatus === 1
                  ? $t('system.message.read')
                  : $t('system.message.unread'),
            ),
        },
      },
      { field: 'createTime', title: $t('common.createTime'), width: 170 },
      {
        title: $t('common.action'),
        field: 'action',
        fixed: 'right',
        width: 120,
        align: 'center',
        slots: { default: 'action' },
      },
    ],
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await messageStore.queryMessages({
            page: page.currentPage,
            pageSize: page.pageSize,
            messageType: activeType.value
              ? Number(activeType.value)
              : undefined,
            ...formValues,
          });
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<SystemMessageApi.MessageItem>,
  gridEvents: {
    cellClick: ({
      column,
      row,
    }: {
      column: { field?: string };
      row: SystemMessageApi.MessageItem;
    }) => {
      // 点击非操作列的行单元格查看详情
      if (column.field !== 'action') {
        showDetail(row);
      }
    },
  },
});

function onRead(row: SystemMessageApi.MessageItem) {
  void messageStore.markRead(row.id).then(() => {
    message.success($t('common.success'));
    gridApi.query();
  });
}

function onReadAll() {
  void messageStore.markAllRead().then(() => {
    message.success($t('common.success'));
    gridApi.query();
  });
}

function onDelete(row: SystemMessageApi.MessageItem) {
  void messageStore.remove(row.id).then(() => {
    message.success($t('common.success'));
    gridApi.query();
  });
}

function onTabChange() {
  gridApi.query();
}
</script>
<template>
  <Page auto-content-height>
    <Tabs v-model:active-key="activeType" class="mb-2" @change="onTabChange">
      <Tabs.TabPane key="" :tab="$t('system.message.typeAll')" />
      <Tabs.TabPane key="1" :tab="$t('system.message.typeSystem')" />
      <Tabs.TabPane key="2" :tab="$t('system.message.typeUser')" />
    </Tabs>
    <Grid :table-title="$t('system.message.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onReadAll">
          {{ $t('system.message.readAll') }}
        </Button>
      </template>
      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('system.message.viewDetail'),
              icon: 'lucide:eye',
              onClick: () => showDetail(row),
            },
            {
              text: $t('system.message.markRead'),
              icon: 'lucide:check',
              ifShow: row.readStatus === 0,
              onClick: () => onRead(row),
            },
            {
              text: $t('system.message.delete'),
              icon: 'lucide:trash-2',
              danger: true,
              popConfirm: {
                title: $t('system.message.deleteConfirm'),
                confirm: () => onDelete(row),
              },
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <MessagePreview v-model:open="previewVisible" :data="previewData" />
  </Page>
</template>
