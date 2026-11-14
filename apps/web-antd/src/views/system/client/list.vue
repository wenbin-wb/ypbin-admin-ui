<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemClientApi } from '#/api/system/client';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  clearClientSecret,
  deleteClient,
  getClientList,
  resetClientSecret,
  updateClientStatus,
} from '#/api/system/client';
import { $t } from '#/locales';

import { useConfirm } from '../_shared/confirm';
import { showSecretOnce } from '../_shared/show-secret';
import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: { ajax: { query: async () => await getClientList() } },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemClientApi.ClientResp>,
});

function onRefresh() {
  gridApi.query();
}

function onEdit(row: SystemClientApi.ClientResp) {
  formDrawerApi.setData(row).open();
}
function onCreate() {
  formDrawerApi.setData(null).open();
}
function onDelete(row: SystemClientApi.ClientResp) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.clientId]),
    duration: 0,
    key: 'del',
  });
  deleteClient(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.clientId]),
        key: 'del',
      });
      onRefresh();
    })
    .catch(() => hideLoading());
}

function onResetSecret(row: SystemClientApi.ClientResp) {
  resetClientSecret(row.id).then((credential) => {
    message.success($t('common.success'));
    showSecretOnce(credential.clientSecret, $t('system.client.clientSecret'));
  });
}

function onClearSecret(row: SystemClientApi.ClientResp) {
  clearClientSecret(row.id).then(() => {
    message.success($t('common.success'));
    onRefresh();
  });
}

/**
 * 启停开关：停用后该客户端无法再登录，必须二次确认。
 * 返回 false 时开关回弹（CellSwitch 的 beforeChange 语义）。
 */
async function onStatusChange(
  newStatus: 0 | 1,
  row: SystemClientApi.ClientResp,
) {
  // 默认客户端承接所有「未声明身份」的登录，停用会让全站登录失败
  if (row.defaultClient) {
    message.warning($t('system.client.defaultClientLocked'));
    return false;
  }
  const statusText =
    newStatus === 1 ? $t('common.enabled') : $t('common.disabled');
  try {
    await useConfirm(
      $t('system.client.statusChangeContent', [row.clientId, statusText]),
      $t('system.client.statusChangeTitle'),
    );
    await updateClientStatus(row.id, newStatus);
    row.status = newStatus;
    return true;
  } catch {
    // 用户取消或请求失败：全局拦截器已给出错误提示，开关保持原状态
    return false;
  }
}
</script>
<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid :table-title="$t('system.client.title')">
      <template #toolbar-tools>
        <Button
          v-access:code="['system:client:add']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.client.name')]) }}
        </Button>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            {
              text: $t('common.edit'),
              icon: 'lucide:edit',
              auth: 'system:client:edit',
              onClick: () => onEdit(row),
            },
            // 默认客户端不能被停用/删除/配置密钥，相关动作直接不展示
            ...(row.defaultClient
              ? []
              : [
                  {
                    text: $t('system.common.resetSecret'),
                    icon: 'lucide:key-round',
                    auth: 'system:client:reset-secret',
                    popConfirm: {
                      title: $t('system.common.resetSecretConfirm'),
                      confirm: () => onResetSecret(row),
                    },
                  },
                  // 只有配置过密钥的客户端才需要「清除密钥」，否则是空操作
                  ...(row.secretConfigured
                    ? [
                        {
                          text: $t('system.client.clearSecret'),
                          icon: 'lucide:key-square',
                          auth: 'system:client:reset-secret',
                          popConfirm: {
                            title: $t('system.client.clearSecretConfirm'),
                            confirm: () => onClearSecret(row),
                          },
                        },
                      ]
                    : []),
                  {
                    text: $t('common.delete'),
                    icon: 'lucide:trash-2',
                    auth: 'system:client:delete',
                    danger: true,
                    popConfirm: {
                      title: $t('ui.actionMessage.deleteConfirm', [
                        row.clientId,
                      ]),
                      confirm: () => onDelete(row),
                    },
                  },
                ]),
          ]"
          align="center"
        />
      </template>
    </Grid>
  </Page>
</template>
