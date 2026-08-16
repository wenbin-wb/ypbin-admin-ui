<script lang="ts" setup>
import type { SystemConfigApi } from '#/api/system/config';

import { onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { getSocialAuthorizeApi, getSocialPlatformsApi } from '#/api';
import { $t } from '#/locales';
import { getSocialPlatformMeta } from '#/utils/social-platform';

defineOptions({ name: 'SocialLogin' });

const SOCIAL_SOURCE_KEY = 'social-login-source';

const platforms = ref<SystemConfigApi.SocialSource[]>([]);
const loadingSource = ref('');

async function handleClick(source: SystemConfigApi.SocialSource) {
  if (loadingSource.value) return;
  loadingSource.value = source;
  try {
    const url = await getSocialAuthorizeApi(source);
    if (!url) {
      throw new Error(`Social authorize URL is empty: ${source}`);
    }
    // 授权跳转会离开当前页，回调页再从 sessionStorage 取回平台标识
    sessionStorage.setItem(SOCIAL_SOURCE_KEY, source);
    window.location.href = url;
  } finally {
    loadingSource.value = '';
  }
}

onMounted(async () => {
  platforms.value =
    (await getSocialPlatformsApi()) as SystemConfigApi.SocialSource[];
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
        :title="$t(getSocialPlatformMeta(source).labelKey)"
        class="flex size-9 cursor-pointer items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleClick(source)"
      >
        <IconifyIcon
          v-if="typeof getSocialPlatformMeta(source).icon === 'string'"
          class="size-5"
          :icon="getSocialPlatformMeta(source).icon as string"
        />
        <component :is="getSocialPlatformMeta(source).icon" v-else />
      </button>
    </div>
  </div>
</template>
