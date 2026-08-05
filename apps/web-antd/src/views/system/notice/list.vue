<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemNoticeApi } from '#/api/system/notice';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteNotice,
  getNoticeList,
  publishNotice,
  revokeNotice,
} from '#/api/system/notice';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import Preview from './modules/preview.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
});

const [PreviewModal, previewModalApi] = useVbenModal({
  connectedComponent: Preview,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: { ajax: { query: async () => await getNoticeList() } },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemNoticeApi.NoticeResp>,
});

function onRefresh() {
  gridApi.query();
}

function onEdit(row: SystemNoticeApi.NoticeResp) {
  formModalApi.setData({ isUpdate: true, row }).open();
}
function onCreate() {
  formModalApi.setData({ isUpdate: false }).open();
}
function onPreview(row: SystemNoticeApi.NoticeResp) {
  previewModalApi.setData(row).open();
}
function onDelete(row: SystemNoticeApi.NoticeResp) {
  deleteNotice(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}
function onRevoke(row: SystemNoticeApi.NoticeResp) {
  revokeNotice(row.id).then(() => {
    message.success($t('common.success'));
    onRefresh();
  });
}
function onPublish(row: SystemNoticeApi.NoticeResp) {
  publishNotice(row.id).then(() => {
    message.success($t('common.success'));
    onRefresh();
  });
}
</script>
<template>
  <Page auto-content-height>
    <FormModal @reload="onRefresh" />
    <PreviewModal />
    <Grid :table-title="$t('system.notice.title')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('common.add') }}
        </Button>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('system.notice.preview'),
              icon: 'lucide:eye',
              onClick: () => onPreview(row),
            },
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              onClick: () => onEdit(row),
            },
            {
              text: $t('system.notice.publish'),
              icon: 'lucide:send',
              ifShow: row.publishStatus !== 2,
              popConfirm: {
                title: $t('system.notice.publishConfirm'),
                confirm: () => onPublish(row),
              },
            },
            {
              text: $t('system.notice.revoke'),
              icon: 'lucide:undo-2',
              ifShow: row.publishStatus === 2,
              popConfirm: {
                title: $t('system.notice.revokeConfirm'),
                confirm: () => onRevoke(row),
              },
            },
            {
              text: $t('common.delete'),
              icon: 'lucide:trash-2',
              danger: true,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.title || '']),
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
