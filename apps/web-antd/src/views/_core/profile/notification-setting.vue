<script setup lang="ts">
import { computed } from 'vue';

import { ProfileNotificationSetting } from '@vben/common-ui';

import { $t } from '#/locales';

const formSchema = computed(() => {
  return [
    {
      value: true,
      fieldName: 'accountPassword',
      label: $t('profile.notification.accountPassword'),
      description: $t('profile.notification.accountPasswordDescription'),
    },
    {
      value: true,
      fieldName: 'systemMessage',
      label: $t('profile.notification.systemMessage'),
      description: $t('profile.notification.systemMessageDescription'),
    },
    {
      value: true,
      fieldName: 'todoTask',
      label: $t('profile.notification.todoTask'),
      description: $t('profile.notification.todoTaskDescription'),
    },
  ];
});
</script>
<template>
  <ProfileNotificationSetting :form-schema="formSchema" />
</template>
