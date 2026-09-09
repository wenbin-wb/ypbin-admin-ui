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
          formApi.setValues({ roleIds: [] });
          message.error(
            extractErrorMessage(error, $t('system.user.roleLoadFailed')),
          );
        } finally {
          roleLoading.value = false;
        }
      } else {
        formApi.setValues({ roleIds: [] });
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
