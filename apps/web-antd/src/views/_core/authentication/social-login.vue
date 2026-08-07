<script lang="ts" setup>
import type { Component } from 'vue';

import { onMounted, ref } from 'vue';

import {
  IconifyIcon,
  SvgDingDingIcon,
  SvgGithubIcon,
  SvgGoogleIcon,
  SvgQQChatIcon,
  SvgWeChatIcon,
} from '@vben/icons';
import { $t } from '@vben/locales';

import { getSocialAuthorizeApi, getSocialPlatformsApi } from '#/api';

defineOptions({ name: 'SocialLogin' });

const SOCIAL_SOURCE_KEY = 'social-login-source';

const platforms = ref<string[]>([]);
const loadingSource = ref('');

/** 值为 Component 时渲染内置 svg 图标，值为 string 时作为 iconify 图标名渲染 */
const PLATFORM_ICONS: Record<string, Component | string> = {
  alipay: 'fa6-brands:alipay',
  dingtalk: SvgDingDingIcon,
  gitee: 'fa6-brands:gitee',
  github: SvgGithubIcon,
  google: SvgGoogleIcon,
  qq: SvgQQChatIcon,
  wechat_open: SvgWeChatIcon,
};

const PLATFORM_LABELS: Record<string, string> = {
  alipay: '支付宝',
  dingtalk: '钉钉',
  gitee: 'Gitee',
  github: 'GitHub',
  google: 'Google',
  qq: 'QQ',
  wechat_open: '微信',
};

async function handleClick(source: string) {
  if (loadingSource.value) return;
  loadingSource.value = source;
  try {
    const url = await getSocialAuthorizeApi(source);
    if (url) {
      // 授权跳转会离开当前页，回调页再从 sessionStorage 取回平台标识
      sessionStorage.setItem(SOCIAL_SOURCE_KEY, source);
      window.location.href = url;
    }
  } finally {
    loadingSource.value = '';
  }
}

onMounted(async () => {
  try {
    platforms.value = (await getSocialPlatformsApi()) ?? [];
  } catch {
    platforms.value = [];
  }
});
</script>

<template>
  <div v-if="platforms.length" class="w-full sm:mx-auto md:max-w-md">
    <div class="mt-4 flex items-center justify-between">
      <span class="w-[35%] border-b border-input dark:border-gray-600"></span>
      <span class="text-center text-xs text-muted-foreground uppercase">
        {{ $t('authentication.thirdPartyLogin') }}
      </span>
      <span class="w-[35%] border-b border-input dark:border-gray-600"></span>
    </div>

    <div class="mt-4 flex flex-wrap justify-center gap-3">
      <button
        v-for="source in platforms"
        :key="source"
        type="button"
        :disabled="!!loadingSource"
        :title="PLATFORM_LABELS[source] || source"
        class="flex size-9 cursor-pointer items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleClick(source)"
      >
        <IconifyIcon
          v-if="typeof PLATFORM_ICONS[source] === 'string'"
          class="size-5"
          :icon="PLATFORM_ICONS[source] as string"
        />
        <component :is="PLATFORM_ICONS[source]" v-else />
      </button>
    </div>
  </div>
</template>
