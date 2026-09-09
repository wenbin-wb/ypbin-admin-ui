<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getRoleAll } from '#/api/system/role';
import { assignUserRoles, getUserDetail } from '#/api/system/user';
import { $t } from '#/locales';
import { extractErrorMessage } from '#/utils/error';

const emit = defineEmits(['success']);
const userId = ref('');
const roleLoading = ref(false);
// 详情回填失败标记：失败时不清空既有勾选，且必须阻断提交，避免“确认”把角色清空
const roleLoadFailed = ref(false);

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'ApiSelect',
      fieldName: 'roleIds',
      label: $t('system.user.roles'),
      componentProps: () => ({
        api: getRoleAll,
        labelField: 'name',
        valueField: 'id',
        mode: 'multiple',
        allowClear: true,
        class: 'w-full',
        // 详情加载期间禁用选择，避免回填未完成就被用户误改
        disabled: roleLoading.value,
      }),
    },
  ],
  showDefaultActions: false,
});

interface AssignRolesData {
  id: string;
  realName?: string;
  roleIds?: string[];
}

const [Modal, modalApi] = useVbenModal<AssignRolesData>({
  onConfirm: async () => {
    // 详情回填失败时禁止提交（否则会把未回填的空角色集覆盖保存上去）
    if (roleLoadFailed.value) {
      message.warning($t('system.user.roleLoadBlocked'));
      return;
    }
    try {
      modalApi.setState({ confirmLoading: true });
      const { valid } = await formApi.validate();
      if (!valid) return;
      const values = await formApi.getValues();
      await assignUserRoles(userId.value, values.roleIds ?? []);
      message.success($t('common.success'));
      modalApi.close();
      emit('success');
    } finally {
      modalApi.setState({ confirmLoading: false });
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = modalApi.getData();
      userId.value = data?.id ?? '';
      formApi.reset();
      roleLoadFailed.value = false;
      modalApi.setState({
        title: `${$t('system.user.assignRoles')} - ${data?.realName ?? ''}`,
      });
      // 行数据（列表接口）不带 roleIds，打开时按 userId 调详情接口回填当前角色
      if (userId.value) {
        roleLoading.value = true;
        try {
          const detail = await getUserDetail(userId.value);
          formApi.setValues({ roleIds: detail?.roleIds ?? [] });
        } catch (error) {
          // 不清空 roleIds（保留回填前状态），标记失败并阻断提交，提示关闭重试
          roleLoadFailed.value = true;
          message.error(
            extractErrorMessage(error, $t('system.user.roleLoadFailed')),
          );
        } finally {
          roleLoading.value = false;
        }
      }
    }
  },
});

defineExpose({ modalApi });
</script>
<template>
  <Modal>
    <Form />
  </Modal>
</template>
