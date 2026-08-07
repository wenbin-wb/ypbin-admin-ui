<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { BasicOption, Recordable } from '@vben/types';

import type { AuthApi } from '#/api/core/auth';

import { computed, ref } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';

import SocialLogin from './social-login.vue';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();

/** 最近一次拖动生成的行为验证码数据，登录时随表单提交 */
const captchaPayload = ref<null | {
  id: string;
  track: AuthApi.CaptchaTrack;
}>(null);

const MOCK_USER_OPTIONS: BasicOption[] = [
  {
    label: 'Super',
    value: 'admin',
  },
  {
    label: 'Admin',
    value: 'lilei',
  },
  {
    label: 'User',
    value: 'wangfang',
  },
];

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenSelect',
      componentProps: {
        options: MOCK_USER_OPTIONS,
        placeholder: $t('authentication.selectAccount'),
      },
      fieldName: 'selectAccount',
      label: $t('authentication.selectAccount'),
      rules: z
        .string()
        .min(1, { message: $t('authentication.selectAccount') })
        .optional()
        .default('admin'),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      dependencies: {
        trigger(values, form) {
          if (values.selectAccount) {
            const findUser = MOCK_USER_OPTIONS.find(
              (item) => item.value === values.selectAccount,
            );
            if (findUser) {
              form.setValues({
                password: '123456',
                username: findUser.value,
              });
            }
          }
        },
        triggerFields: ['selectAccount'],
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
    {
      component: 'TianaiCaptcha',
      componentProps: {
        onVerify: (payload: { id: string; track: AuthApi.CaptchaTrack }) => {
          captchaPayload.value = payload;
        },
      },
      // 不设前端校验规则：是否必须由后端 LOGIN_CAPTCHA_ENABLED 决定，
      // 未完成拖动时后端会返回“请先完成验证码校验”
      fieldName: 'captcha',
      label: $t('ui.captcha.title'),
    },
  ];
});

async function handleLogin(values: Recordable<any>) {
  const params: AuthApi.LoginParams = {
    password: values.password,
    username: values.username,
  };
  if (captchaPayload.value) {
    params.captchaId = captchaPayload.value.id;
    params.captchaTrack = captchaPayload.value.track;
  }
  await authStore.authLogin(params);
}
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    @submit="handleLogin"
  >
    <template #third-party-login>
      <SocialLogin />
    </template>
  </AuthenticationLogin>
</template>
