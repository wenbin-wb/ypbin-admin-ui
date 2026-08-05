<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { ProfileSecuritySetting } from '@vben/common-ui';

import { getProfile } from '#/api/system/profile';
import { $t } from '#/locales';

const profile = ref<Record<string, any>>({});

/** 展示用脱敏：手机保留前3后4，邮箱保留首字符与域名 */
function maskPhone(phone?: string) {
  if (!phone || phone.length < 7) return phone ?? '';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
function maskEmail(email?: string) {
  if (!email || !email.includes('@')) return email ?? '';
  const [name, domain] = email.split('@');
  const head = name?.slice(0, 1) ?? '';
  return `${head}***@${domain}`;
}

const formSchema = computed(() => {
  const p = profile.value;
  return [
    {
      value: true,
      fieldName: 'accountPassword',
      label: $t('profile.security.accountPassword'),
      description: p.pwdResetTime
        ? $t('profile.security.lastChanged', [p.pwdResetTime])
        : $t('profile.security.neverChanged'),
    },
    {
      value: !!p.phone,
      fieldName: 'securityPhone',
      label: $t('profile.security.phone'),
      description: p.phone
        ? $t('profile.security.phoneBound', [maskPhone(p.phone)])
        : $t('profile.security.unbound'),
    },
    {
      value: !!p.email,
      fieldName: 'securityEmail',
      label: $t('profile.security.email'),
      description: p.email
        ? $t('profile.security.emailBound', [maskEmail(p.email)])
        : $t('profile.security.unbound'),
    },
  ];
});

onMounted(async () => {
  profile.value = await getProfile();
});
</script>
<template>
  <ProfileSecuritySetting :form-schema="formSchema" />
</template>
