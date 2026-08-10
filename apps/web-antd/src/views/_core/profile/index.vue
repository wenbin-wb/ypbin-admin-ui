<script setup lang="ts">
import { ref } from 'vue';

import { Profile } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { $t } from '#/locales';

import ProfileBase from './base-setting.vue';
import ProfileNotificationSetting from './notification-setting.vue';
import ProfilePasswordSetting from './password-setting.vue';
import ProfileSecuritySetting from './security-setting.vue';

const userStore = useUserStore();

const tabsValue = ref<string>('basic');

const tabs = ref([
  {
    label: $t('profile.tabs.basic'),
    value: 'basic',
  },
  {
    label: $t('profile.tabs.security'),
    value: 'security',
  },
  {
    label: $t('profile.tabs.password'),
    value: 'password',
  },
  {
    label: $t('profile.tabs.notification'),
    value: 'notice',
  },
]);
</script>
<template>
  <Profile
    v-model:model-value="tabsValue"
    :user-info="userStore.userInfo"
    :tabs="tabs"
    :title="$t('profile.title')"
  >
    <template #content>
      <ProfileBase v-if="tabsValue === 'basic'" />
      <ProfileSecuritySetting v-if="tabsValue === 'security'" />
      <ProfilePasswordSetting v-if="tabsValue === 'password'" />
      <ProfileNotificationSetting v-if="tabsValue === 'notice'" />
    </template>
  </Profile>
</template>
