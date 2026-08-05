<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { resetUserPassword } from '#/api/system/user';
import { $t } from '#/locales';

const emit = defineEmits(['success']);
const userId = ref('');

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'InputPassword',
      fieldName: 'password',
      label: $t('system.user.password'),
      rules: 'required',
      componentProps: { placeholder: $t('system.user.newPasswordPlaceholder') },
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
      await resetUserPassword(userId.value, values.password);
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
      modalApi.setState({
        title: `${$t('system.user.resetPassword')} - ${data?.realName ?? ''}`,
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
