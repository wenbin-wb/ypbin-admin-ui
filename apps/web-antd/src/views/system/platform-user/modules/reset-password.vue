<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm, z } from '#/adapter/form';
import { resetPlatformUserPassword } from '#/api/system/platform-user';
import { $t } from '#/locales';
import { isPasswordPolicySatisfied } from '#/utils/password';

const emit = defineEmits(['success']);
const userId = ref('');

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'InputPassword',
      fieldName: 'password',
      label: $t('system.platformUser.password'),
      rules: z
        .string()
        .min(1, {
          message: $t('ui.formRules.required', [
            $t('system.platformUser.password'),
          ]),
        })
        .refine(isPasswordPolicySatisfied, {
          message: $t('system.platformUser.passwordRule'),
        }),
      componentProps: {
        placeholder: $t('system.platformUser.newPasswordPlaceholder'),
      },
    },
  ],
  showDefaultActions: false,
});

interface ResetPasswordData {
  id: string;
  /** 显示名，已由调用方回退为登录账号 */
  name: string;
}

const [Modal, modalApi] = useVbenModal<ResetPasswordData>({
  async onConfirm() {
    try {
      modalApi.setState({ confirmLoading: true });
      const { valid } = await formApi.validate();
      if (!valid) {
        return;
      }
      const values = await formApi.getValues();
      await resetPlatformUserPassword(userId.value, values.password);
      message.success($t('common.success'));
      modalApi.close();
      emit('success');
    } finally {
      modalApi.setState({ confirmLoading: false });
    }
  },
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = modalApi.getData();
      userId.value = data?.id ?? '';
      formApi.reset();
      modalApi.setState({
        title: `${$t('system.platformUser.resetPassword')} - ${data?.name ?? ''}`,
      });
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
