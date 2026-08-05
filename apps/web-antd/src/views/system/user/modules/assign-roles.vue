<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getRoleAll } from '#/api/system/role';
import { assignUserRoles } from '#/api/system/user';
import { $t } from '#/locales';

const emit = defineEmits(['success']);
const userId = ref('');

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'ApiSelect',
      fieldName: 'roleIds',
      label: $t('system.user.roles'),
      componentProps: {
        api: getRoleAll,
        labelField: 'name',
        valueField: 'id',
        mode: 'multiple',
        allowClear: true,
        class: 'w-full',
      },
    },
  ],
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
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
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = modalApi.getData<Record<string, any>>();
      userId.value = data?.id;
      formApi.resetForm();
      formApi.setValues({ roleIds: data?.roleIds ?? [] });
      modalApi.setState({
        title: `${$t('system.user.assignRoles')} - ${data?.realName ?? ''}`,
      });
    }
  },
});
</script>
<template>
  <Modal>
    <Form />
  </Modal>
</template>
