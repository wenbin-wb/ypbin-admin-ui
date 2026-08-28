<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemLicenseApi } from '#/api/system/license';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Typography } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteLicense,
  downloadLicenseFile,
  generateLicenseKey,
  getLicenseDelivery,
  getLicenseList,
  revokeLicense,
  submitLicense,
} from '#/api/system/license';
import { $t } from '#/locales';
import { downloadByBlob } from '#/utils/file';

import { showKeyPairOnce, showLicenseDelivery } from '../_shared/show-secret';
import { useColumns, useGridFormSchema } from './data';
import Approve from './modules/approve.vue';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({ connectedComponent: Form });
const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
});
const [ApproveModal, approveModalApi] = useVbenModal({
  connectedComponent: Approve,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          await getLicenseList({
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
  } as VxeTableGridOptions<SystemLicenseApi.SystemLicense>,
});

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData(null).open();
}

function onEdit(row: SystemLicenseApi.SystemLicense) {
  formDrawerApi.setData(row).open();
}

function onViewDetail(row: SystemLicenseApi.SystemLicense) {
  detailDrawerApi.setData(row).open();
}

function onApprove(row: SystemLicenseApi.SystemLicense) {
  approveModalApi.setData(row).open();
}

function onDelete(row: SystemLicenseApi.SystemLicense) {
  deleteLicense(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch((error) => {
      console.error('Failed to delete license:', error);
      message.error($t('common.requestFailed'));
    });
}

function onSubmit(row: SystemLicenseApi.SystemLicense) {
  submitLicense(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch((error) => {
      console.error('Failed to submit license:', error);
      message.error($t('common.requestFailed'));
    });
}

function onRevoke(row: SystemLicenseApi.SystemLicense) {
  revokeLicense(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch((error) => {
      console.error('Failed to revoke license:', error);
      message.error($t('common.requestFailed'));
    });
}

/** 下载 .lic 授权文件：后端以二进制流返回，前端触发浏览器下载 */
async function onDownload(row: SystemLicenseApi.SystemLicense) {
  try {
    const blob = await downloadLicenseFile(row.id);
    // 后端业务失败时返回统一 JSON（HTTP 恒 200），不能把错误信息当 .lic 下载下来掩盖问题
    const text = await blob.text();
    if (text.trimStart().startsWith('{')) {
      try {
        const err = JSON.parse(text) as { code?: number; message?: string };
        if (err.code !== undefined && err.code !== 200) {
          message.error(
            err.message || $t('ui.fallback.http.internalServerError'),
          );
          return;
        }
      } catch {
        // 非 JSON 说明是正常授权串，继续走下载
      }
    }
    downloadByBlob(blob, `${row.licenseId ?? row.id}.lic`);
  } catch {
    // 请求级失败已由全局错误拦截器统一提示
  }
}

/** 查看可重复读取的交付信息：授权码（CODE 模式）与联机应用 Access Key */
function onViewDelivery(row: SystemLicenseApi.SystemLicense) {
  getLicenseDelivery(row.id).then((delivery) => {
    showLicenseDelivery(delivery, $t('system.license.deliveryTitle'));
  });
}

/** 生成签发密钥对：结果仅此一次可见，分块弹窗展示，支持复制与保存为文件 */
function onGenerateKey() {
  generateLicenseKey().then((keyPair) => {
    showKeyPairOnce(keyPair, $t('system.license.genkeyTitle'));
  });
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <DetailDrawer />
    <ApproveModal @success="onRefresh" />
    <Grid :table-title="$t('system.license.list')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:license:genkey']"
          class="mr-2"
          @click="onGenerateKey"
        >
          {{ $t('system.license.genkey') }}
        </Button>
        <Button
          v-access:code="['system:license:add']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.license.name')]) }}
        </Button>
      </template>

      <template #licenseId="{ row }">
        <Typography.Text
          v-if="row.licenseId"
          :copyable="{
            tooltip: false,
            onCopy: () => message.success($t('common.copySuccess')),
          }"
        >
          {{ row.licenseId }}
        </Typography.Text>
        <span v-else>-</span>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.detail'),
              icon: 'lucide:eye',
              auth: 'system:license:list',
              onClick: () => onViewDetail(row),
            },
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'system:license:edit',
              ifShow: ['DRAFT', 'REJECTED'].includes(row.approveStatus ?? ''),
              onClick: () => onEdit(row),
            },
            {
              text: $t('system.license.submit'),
              icon: 'lucide:send',
              auth: 'system:license:submit',
              ifShow: ['DRAFT', 'REJECTED'].includes(row.approveStatus ?? ''),
              popConfirm: {
                title: $t('system.license.submitConfirm', [row.subject]),
                confirm: () => onSubmit(row),
              },
            },
            {
              text: $t('system.license.approve'),
              icon: 'lucide:gavel',
              auth: 'system:license:approve',
              ifShow: row.approveStatus === 'PENDING',
              onClick: () => onApprove(row),
            },
          ]"
          :more-text="$t('common.more')"
          :dropdown-actions="[
            {
              text: $t('system.license.viewAuthCode'),
              auth: 'system:license:delivery',
              ifShow:
                row.approveStatus === 'ISSUED' && row.deliveryMode === 'CODE',
              onClick: () => onViewDelivery(row),
            },
            {
              text: $t('system.license.download'),
              auth: 'system:license:delivery',
              ifShow:
                row.approveStatus === 'ISSUED' && row.deliveryMode === 'FILE',
              onClick: () => onDownload(row),
            },
            {
              text: $t('system.license.viewAppInfo'),
              auth: 'system:license:delivery',
              ifShow:
                row.approveStatus === 'ISSUED' && row.deliveryMode === 'FILE',
              onClick: () => onViewDelivery(row),
            },
            {
              text: $t('system.license.revoke'),
              auth: 'system:license:revoke',
              ifShow: row.approveStatus === 'ISSUED',
              popConfirm: {
                title: $t('system.license.revokeConfirm', [row.subject]),
                confirm: () => onRevoke(row),
              },
            },
            {
              text: $t('common.delete'),
              danger: true,
              auth: 'system:license:delete',
              ifShow: ['DRAFT', 'REJECTED'].includes(row.approveStatus ?? ''),
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.subject]),
                confirm: () => onDelete(row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
