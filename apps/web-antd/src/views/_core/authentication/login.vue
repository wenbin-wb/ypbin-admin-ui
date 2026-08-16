<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import type { AuthApi } from '#/api/core/auth';

import { computed, ref } from 'vue';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';

import SocialLogin from './social-login.vue';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();

const loginRef = ref<InstanceType<typeof AuthenticationLogin>>();

/** 最近一次拖动生成的行为验证码数据，登录时随表单提交 */
const captchaPayload = ref<null | {
  id: string;
  track: AuthApi.CaptchaTrack;
}>(null);

// 演示登录账号：直接用平台超管 admin，每天重置数据库后由 Bootstrap 按 .env 重建，密码与 ADMIN_BOOTSTRAP_PASSWORD 一致
const DEMO_USERNAME = 'admin';
const DEMO_PASSWORD = 'pt5aQ5E6t8dkVkMp';

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        'data-testid': 'login-username',
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'username',
      defaultValue: DEMO_USERNAME,
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        'data-testid': 'login-password',
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      defaultValue: DEMO_PASSWORD,
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
  try {
    await authStore.authLogin(params);
  } catch (error) {
    // 登录失败（含验证码校验失败）：验证码已被消费或已过期，换一张避免用旧数据再提交
    refreshCaptcha();
    throw error;
  }
}

function refreshCaptcha() {
  captchaPayload.value = null;
  const captchaComponent = loginRef.value
    ?.getFormApi()
    .getFieldComponentRef<{ fetchCaptcha: () => void }>('captcha');
  captchaComponent?.fetchCaptcha();
}
</script>

<template>
  <AuthenticationLogin
    ref="loginRef"
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    @submit="handleLogin"
  >
    <template #title>
      <div class="mb-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="flex items-center justify-center gap-2.5">
          <img src="/ypbin-logo.svg" alt="ypbin" class="h-9 w-9 shrink-0" />
          <h2 class="text-2xl font-bold tracking-tight text-foreground">
            {{ $t('auth.title') }}
          </h2>
        </div>
        <p class="mt-2 text-center text-sm text-muted-foreground">
          {{ $t('auth.techStack') }}
        </p>
        <div
          class="mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-center text-xs text-muted-foreground"
        >
          {{ $t('auth.demoTip') }}
        </div>
      </div>
    </template>
    <template #third-party-login>
      <SocialLogin />
    </template>
  </AuthenticationLogin>
</template>
