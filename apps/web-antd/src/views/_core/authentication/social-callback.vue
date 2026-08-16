<script lang="ts" setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';

import { message, Spin } from 'ant-design-vue';

import { socialLoginApi } from '#/api';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';

defineOptions({ name: 'SocialCallback' });

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const SOCIAL_SOURCE_KEY = 'social-login-source';

async function handleCallback() {
  const source =
    (route.query.source as string) || sessionStorage.getItem(SOCIAL_SOURCE_KEY);
  const code = route.query.code as string | undefined;
  const auth_code = route.query.auth_code as string | undefined;
  const state = route.query.state as string | undefined;
  if (!source || (!code && !auth_code)) {
    message.error($t('authentication.socialLoginFailed'));
    await router.replace(LOGIN_PATH);
    return;
  }
  sessionStorage.removeItem(SOCIAL_SOURCE_KEY);
  try {
    const { accessToken } = await socialLoginApi(source, {
      auth_code,
      code,
      state,
    });
    if (accessToken) {
      await authStore.socialLogin(accessToken);
    } else {
      message.error($t('authentication.socialLoginFailed'));
      await router.replace(LOGIN_PATH);
    }
  } catch {
    message.error($t('authentication.socialLoginFailed'));
    await router.replace(LOGIN_PATH);
  }
}

onMounted(handleCallback);
</script>

<template>
  <div class="flex h-full w-full flex-col items-center justify-center gap-4">
    <Spin size="large" />
    <span class="text-sm text-muted-foreground">
      {{ $t('authentication.socialCallbackLoading') }}
    </span>
  </div>
</template>
