<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { Recordable } from '@vben/types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemDeptApi, SystemUserApi } from '#/api';

import { onMounted, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { Page, Tree, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, Card, InputSearch, message, Upload } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteUser,
  downloadImportTemplate,
  exportUsers,
  getDeptList,
  getUserList,
  importUsers,
  updateUserStatus,
} from '#/api';
import { $t } from '#/locales';
import { createDateRangeCodec } from '#/utils/date-range-codec';
import { useConfirm } from '#/views/system/_shared/confirm';

import { useColumns, useGridFormSchema } from './data';
import AssignRoles from './modules/assign-roles.vue';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';
import ResetPassword from './modules/reset-password.vue';

interface UserSearchFormValues extends Record<string, unknown> {
  createTime?: [Dayjs, Dayjs];
}

const userSearchCodec = createDateRangeCodec<UserSearchFormValues>()({
  endField: 'endTime',
  rangeField: 'createTime',
  startField: 'startTime',
});

type UserSearchSubmitValues = ReturnType<typeof userSearchCodec.encode>;

const deptList = ref<SystemDeptApi.SystemDept[]>([]);
const inputSearchValue = ref('');
const selectedDeptId = ref<string>('');

const { hasAccessByCodes } = useAccess();
const canEdit = hasAccessByCodes(['system:user:edit']);
const canAssignRoles = canEdit && hasAccessByCodes(['system:role:list']);

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: false,
});

const [AssignRolesModal, assignRolesModalApi] = useVbenModal({
  connectedComponent: AssignRoles,
  destroyOnClose: true,
});

const [ResetPasswordModal, resetPasswordModalApi] = useVbenModal({
  connectedComponent: ResetPassword,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    codec: userSearchCodec,
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(canEdit ? onStatusChange : undefined),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: UserSearchSubmitValues) => {
          return await getUserList({
            page: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            deptId: selectedDeptId.value,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
    },

    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemUserApi.SystemUser>,
});

/**
 * 状态开关即将改变
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(
  newStatus: 0 | 1,
  row: SystemUserApi.SystemUser,
): Promise<boolean> {
  const status: Recordable<string> = {
    0: $t('common.disabled'),
    1: $t('common.enabled'),
  };
  try {
    await useConfirm(
      $t('system.user.statusChangeContent', [
        row.realName,
        status[newStatus.toString()],
      ]),
      $t('system.user.statusChangeTitle'),
    );
    await updateUserStatus(row.id, { status: newStatus });
    return true;
  } catch {
    return false;
  }
}

function onEdit(row: SystemUserApi.SystemUser) {
  formDrawerApi.setData(row).open();
}

function onDetail(row: SystemUserApi.SystemUser) {
  detailDrawerApi.setData(row).open();
}

function onDelete(row: SystemUserApi.SystemUser) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.realName]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteUser(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.realName]),
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

function onAssignRoles(row: SystemUserApi.SystemUser) {
  assignRolesModalApi
    .setData({
      id: row.id,
      realName: row.realName,
      roleIds: row.roleIds ?? [],
    })
    .open();
}

function onResetPassword(row: SystemUserApi.SystemUser) {
  resetPasswordModalApi.setData({ id: row.id, realName: row.realName }).open();
}

const importModalVisible = ref(false);
const importLoading = ref(false);

/** 导出用户 Excel */
async function onExport() {
  try {
    const formValues = gridApi.formApi?.form?.values ?? {};
    const blob = await exportUsers({
      ...formValues,
      deptId: selectedDeptId.value,
    } as any);
    const url = URL.createObjectURL(blob as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = $t('system.user.exportFileName');
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export users:', error);
    message.error($t('system.user.exportFailed'));
  }
}

/** 下载用户导入模板 */
async function onDownloadTemplate() {
  try {
    const blob = await downloadImportTemplate();
    const url = URL.createObjectURL(blob as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = $t('system.user.importTemplateFileName');
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download import template:', error);
    message.error($t('system.user.templateDownloadFailed'));
  }
}

/** 导入用户 */
async function onImportFile(file: File) {
  importLoading.value = true;
  try {
    const result: any = await importUsers(file);
    const {
      successCount = 0,
      failureCount = 0,
      failureMessages = [],
    } = result ?? {};
    if (failureCount > 0) {
      const errMsg = failureMessages
        .slice(0, 5)
        .map((msg: string) => msg)
        .join('\n');
      message.warning(
        $t('system.user.importResult', [successCount, failureCount, errMsg]),
      );
    } else {
      message.success($t('system.user.importSuccessCount', [successCount]));
    }
    onRefresh();
  } catch (error) {
    console.error('Failed to import users:', error);
    message.error($t('system.user.importFailed'));
  } finally {
    importLoading.value = false;
    importModalVisible.value = false;
  }
  return false; // 阻止 antd Upload 自动上传
}

async function loadDeptList() {
  try {
    const res = await getDeptList();
    deptList.value = res;
  } catch (error) {
    console.error('Failed to load department list:', error);
  }
}

function selectDept(v: string) {
  selectedDeptId.value = v;
  gridApi.query();
}

function searchDept(value: string) {
  if (!value) {
    loadDeptList();
    return;
  }
  const filtered = deptList.value.filter((dept) =>
    dept.name.toLowerCase().includes(value.toLowerCase()),
  );
  deptList.value = filtered;
}

onMounted(() => {
  loadDeptList();
});

watch(inputSearchValue, (value) => {
  searchDept(value);
});
</script>
<template>
  <Page auto-content-height data-testid="page-system-user">
    <FormDrawer @success="onRefresh" />
    <DetailDrawer @success="onRefresh" />
    <AssignRolesModal @success="onRefresh" />
    <ResetPasswordModal @success="onRefresh" />

    <!-- 导入用户弹窗 -->
    <Modal
      v-model:open="importModalVisible"
      :confirm-loading="importLoading"
      :footer="null"
      :title="$t('system.user.importTitle')"
    >
      <div class="mb-3">
        <Button type="link" @click="onDownloadTemplate">
          {{ $t('system.user.importDownloadTemplate') }}
        </Button>
      </div>
      <Upload
        :before-upload="onImportFile"
        :show-upload-list="false"
        accept=".xlsx,.xls"
      >
        <Button :loading="importLoading" type="primary">
          {{ $t('system.user.importChooseFile') }}
        </Button>
      </Upload>
      <p class="mt-2 text-gray-500 text-sm">
        {{ $t('system.user.importHint') }}
      </p>
    </Modal>

    <div class="flex size-full">
      <Card class="w-1/6">
        <InputSearch
          v-model:value="inputSearchValue"
          :placeholder="$t('system.user.placeholder')"
        />
        <Tree
          label-field="name"
          value-field="id"
          :tree-data="deptList"
          :default-expanded-level="2"
          @select="selectDept"
        />
      </Card>

      <div class="w-5/6 ml-4">
        <Grid :table-title="$t('system.user.list')">
          <template #toolbar-tools>
            <Button
              v-access:code="['system:user:add']"
              type="primary"
              @click="onCreate"
            >
              <Plus class="size-5" />
              {{ $t('ui.actionTitle.create', [$t('system.user.name')]) }}
            </Button>
            <Button
              v-access:code="['system:user:export']"
              class="ml-2"
              @click="onExport"
            >
              {{ $t('system.user.export') }}
            </Button>
            <Button
              v-access:code="['system:user:import']"
              class="ml-2"
              @click="importModalVisible = true"
            >
              {{ $t('system.user.import') }}
            </Button>
          </template>
          <template #action="{ row }">
            <VbenTableAction
              :actions="[
                {
                  text: $t('common.edit'),
                  icon: 'lucide:edit',
                  auth: 'system:user:edit',
                  onClick: () => onEdit(row),
                },
                {
                  text: $t('common.delete'),
                  icon: 'lucide:trash-2',
                  auth: 'system:user:delete',
                  danger: true,
                  popConfirm: {
                    title: $t('ui.actionMessage.deleteConfirm', [row.realName]),
                    confirm: () => onDelete(row),
                  },
                },
              ]"
              :dropdown-actions="[
                {
                  text: $t('common.detail'),
                  icon: 'lucide:eye',
                  auth: 'system:user:list',
                  onClick: () => onDetail(row),
                },
                {
                  text: $t('system.user.assignRoles'),
                  icon: 'lucide:users',
                  auth: 'system:user:edit',
                  ifShow: canAssignRoles,
                  onClick: () => onAssignRoles(row),
                },
                {
                  text: $t('system.user.resetPassword'),
                  icon: 'lucide:key-round',
                  auth: 'system:user:edit',
                  onClick: () => onResetPassword(row),
                },
              ]"
              :more-text="$t('common.more')"
              align="center"
            />
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>
