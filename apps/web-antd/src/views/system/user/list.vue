<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { Recordable } from '@vben/types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemDeptApi, SystemUserApi } from '#/api';

import { onMounted, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { Page, Tree, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { createIconifyIcon, Download, Plus } from '@vben/icons';

import { Button, Card, InputSearch, message } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteUser,
  exportUsers,
  getDeptList,
  getUserList,
  updateUserStatus,
} from '#/api';
import { $t } from '#/locales';
import { createDateRangeCodec } from '#/utils/date-range-codec';
import { downloadBlobSafe } from '#/utils/file';
import { useConfirm } from '#/views/system/_shared/confirm';

import { useColumns, useGridFormSchema } from './data';
import AssignRoles from './modules/assign-roles.vue';
import Detail from './modules/detail.vue';
import Form from './modules/form.vue';
import Import from './modules/import.vue';
import ResetPassword from './modules/reset-password.vue';

const UploadIcon = createIconifyIcon('lucide:upload');

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
  destroyOnClose: false,
});

const [ResetPasswordModal, resetPasswordModalApi] = useVbenModal({
  connectedComponent: ResetPassword,
  destroyOnClose: false,
});

const [ImportModal, importModalApi] = useVbenModal({
  connectedComponent: Import,
  destroyOnClose: false,
});

async function onStatusChange(newStatus: 0 | 1, row: SystemUserApi.SystemUser) {
  // 小程序用户的状态由微信登录流程维护，后台不提供启停
  if (row.userType === 'MINIAPP') {
    message.warning($t('system.user.miniappStatusReadonly'));
    return false;
  }
  const statusText =
    newStatus === 1 ? $t('common.enabled') : $t('common.disabled');
  try {
    await useConfirm(
      $t('system.user.statusChangeContent', [
        row.realName || row.username,
        statusText,
      ]),
      $t('system.user.statusChangeTitle'),
    );
    await updateUserStatus(row.id, { status: newStatus });
    row.status = newStatus;
    message.success($t('common.success'));
    return true;
  } catch {
    return false;
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues: Recordable<any>) => {
          const params: SystemUserApi.UserQuery = {
            ...userSearchCodec.encode(formValues as UserSearchSubmitValues),
            // 左侧树优先，其次用搜索表单里选的部门；两者都空表示不限部门
            deptId: selectedDeptId.value || formValues?.deptId || '',
            page: page.currentPage,
            pageSize: page.pageSize,
          };
          return await getUserList(params);
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

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  // 置空弹层数据，避免沿用上一次“编辑”残留的行数据
  formDrawerApi.setData(null).open();
}

function onEdit(row: SystemUserApi.SystemUser) {
  formDrawerApi.setData(row).open();
}

function onDetail(row: SystemUserApi.SystemUser) {
  detailDrawerApi.setData(row).open();
}

async function onDelete(row: SystemUserApi.SystemUser) {
  await deleteUser(row.id);
  // 展示名可能为 null（后端 real_name 允许 NULL），回退登录账号避免提示语缺名字
  message.success(
    $t('ui.actionMessage.deleteSuccess', [row.realName || row.username]),
  );
  onRefresh();
}

function onAssignRoles(row: SystemUserApi.SystemUser) {
  assignRolesModalApi.setData({ id: row.id, roleIds: row.roleIds }).open();
}

function onResetPassword(row: SystemUserApi.SystemUser) {
  resetPasswordModalApi.setData({ id: row.id, realName: row.realName }).open();
}

function onOpenImport() {
  importModalApi.open();
}

const exportLoading = ref(false);

/** 导出用户 Excel */
async function onExport() {
  exportLoading.value = true;
  try {
    const formValues = gridApi.formApi?.form?.values ?? {};
    const params = {
      ...userSearchCodec.encode(formValues as UserSearchSubmitValues),
      // 与列表同一口径：左侧树优先，其次搜索表单里的部门
      deptId:
        selectedDeptId.value ||
        (formValues as { deptId?: string })?.deptId ||
        '',
    } as unknown as SystemUserApi.UserQuery;
    const blob = await exportUsers(params);
    const downloaded = await downloadBlobSafe(
      blob,
      $t('system.user.exportFileName') || '用户列表.xlsx',
      $t('system.user.exportFailed'),
    );
    if (downloaded) {
      message.success($t('common.success'));
    }
  } catch (error) {
    console.error('Failed to export users:', error);
    message.error($t('system.user.exportFailed'));
  } finally {
    exportLoading.value = false;
  }
}

async function loadDeptList() {
  try {
    const res = await getDeptList();
    deptList.value = res;
  } catch (error) {
    console.error('Failed to load department list:', error);
  }
}

/**
 * 部门树选中回调。
 *
 * <p>Tree 的 select 事件回传的是整棵节点（FlattenedItem，形如
 * `{ value: 原始节点, level, index, hasChildren, bind }`），而不是 value-field 对应的值。
 * 直接把节点当部门 ID 传下去会把整个对象序列化进查询串，请求被容器以 400 拒绝，
 * 因此这里取 `node.value.id`。</p>
 */
function selectDept(node: unknown) {
  const flattened = node as null | { value?: { id?: string } };
  selectedDeptId.value = flattened?.value?.id ?? '';
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
    <ImportModal @success="onRefresh" />

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
              v-access:code="['system:user:add']"
              class="ml-2"
              @click="onOpenImport"
            >
              <UploadIcon class="mr-1 size-4" />
              {{ $t('system.user.import') }}
            </Button>
            <Button
              v-access:code="['system:user:list']"
              class="ml-2"
              :loading="exportLoading"
              @click="onExport"
            >
              <Download class="mr-1 size-4" />
              {{ $t('system.user.export') }}
            </Button>
          </template>
          <template #action="{ row }">
            <VbenTableAction
              :actions="[
                {
                  text: $t('common.edit'),
                  icon: 'lucide:edit',
                  auth: 'system:user:edit',
                  // 小程序用户由微信登录自动创建，不参与后台账号的编辑/删除
                  ifShow: () => row.userType !== 'MINIAPP',
                  onClick: () => onEdit(row),
                },
                {
                  text: $t('common.delete'),
                  icon: 'lucide:trash-2',
                  auth: 'system:user:delete',
                  danger: true,
                  ifShow: () => row.userType !== 'MINIAPP',
                  popConfirm: {
                    title: $t('ui.actionMessage.deleteConfirm', [
                      row.realName || row.username,
                    ]),
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
                  ifShow: () => canAssignRoles && row.userType !== 'MINIAPP',
                  onClick: () => onAssignRoles(row),
                },
                {
                  text: $t('system.user.resetPassword'),
                  icon: 'lucide:key-round',
                  auth: 'system:user:edit',
                  ifShow: () => row.userType !== 'MINIAPP',
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
