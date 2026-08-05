<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemLicenseApi } from '#/api/system/license';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteLicense,
  downloadLicenseFile,
  generateLicenseKey,
  getLicenseAuthCode,
  getLicenseList,
  revokeLicense,
  submitLicense,
} from '#/api/system/license';
import { $t } from '#/locales';

import { showSecretOnce } from '../_shared/show-secret';
import { useColumns, useGridFormSchema } from './data';
import Approve from './modules/approve.vue';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({ connectedComponent: Form });
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
  formDrawerApi.setData({}).open();
}

function onEdit(row: SystemLicenseApi.SystemLicense) {
  formDrawerApi.setData(row).open();
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
    .catch(() => {});
}

function onSubmit(row: SystemLicenseApi.SystemLicense) {
  submitLicense(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}

function onRevoke(row: SystemLicenseApi.SystemLicense) {
  revokeLicense(row.id)
    .then(() => {
      message.success($t('common.success'));
      onRefresh();
    })
    .catch(() => {});
}

/** 下载 .lic 授权文件：后端以二进制流返回，前端触发浏览器下载 */
function onDownload(row: SystemLicenseApi.SystemLicense) {
  downloadLicenseFile(row.id).then((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${row.licenseId ?? row.id}.lic`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

/** 查看内联授权码：复用密钥展示弹窗，内置复制 */
function onViewAuthCode(row: SystemLicenseApi.SystemLicense) {
  getLicenseAuthCode(row.id).then((authCode) => {
    showSecretOnce(authCode, $t('system.license.authCodeTitle'));
  });
}

/** 生成签发密钥对：结果仅此一次可见，弹窗展示并可复制 */
function onGenerateKey() {
  generateLicenseKey().then((keyPair) => {
    const content = [
      `${$t('system.license.publicKey')}:\n${keyPair.publicKey}`,
      `${$t('system.license.privateKey')}:\n${keyPair.privateKey}`,
      `${$t('system.license.sm4Key')}:\n${keyPair.sm4Key}`,
    ].join('\n\n');
    showSecretOnce(content, $t('system.license.genkeyTitle'));
  });
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
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

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
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
              auth: 'system:license:list',
              ifShow:
                row.approveStatus === 'ISSUED' && row.deliveryMode === 'CODE',
              onClick: () => onViewAuthCode(row),
            },
            {
              text: $t('system.license.download'),
              auth: 'system:license:list',
              ifShow:
                row.approveStatus === 'ISSUED' && row.deliveryMode === 'FILE',
              onClick: () => onDownload(row),
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
