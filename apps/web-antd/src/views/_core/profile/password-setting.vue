<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, ref } from 'vue';

import { ProfilePasswordSetting, z } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { changePassword } from '#/api/system/profile';
import { $t } from '#/locales';

const passwordSettingRef = ref<InstanceType<typeof ProfilePasswordSetting>>();
const submitting = ref(false);

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'oldPassword',
      label: $t('system.user.password'),
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('profile.oldPasswordPlaceholder'),
      },
    },
    {
      fieldName: 'newPassword',
      label: $t('profile.newPassword'),
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: $t('profile.newPasswordPlaceholder'),
      },
    },
    {
      fieldName: 'confirmPassword',
      label: $t('profile.confirmPassword'),
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: $t('profile.confirmPasswordPlaceholder'),
      },
      dependencies: {
        rules(values) {
          const { newPassword } = values;
          return z
            .string({ error: $t('profile.confirmPasswordPlaceholder') })
            .min(1, { message: $t('profile.confirmPasswordPlaceholder') })
            .refine((value) => value === newPassword, {
              message: $t('profile.passwordMismatch'),
            });
        },
        triggerFields: ['newPassword'],
      },
    },
  ];
});

async function handleSubmit(values: Record<string, string | undefined>) {
  if (submitting.value || !values.oldPassword || !values.newPassword) {
    return;
  }

  submitting.value = true;
  try {
    await changePassword({
      oldPassword: values.oldPassword,
      newPassword: values.newPassword,
    });
    await passwordSettingRef.value?.reset();
    message.success($t('common.success'));
  } finally {
    submitting.value = false;
  }
}
</script>
<template>
  <ProfilePasswordSetting
    ref="passwordSettingRef"
    class="w-1/3"
    :form-schema="formSchema"
    :submitting="submitting"
    @submit="handleSubmit"
  />
</template>
