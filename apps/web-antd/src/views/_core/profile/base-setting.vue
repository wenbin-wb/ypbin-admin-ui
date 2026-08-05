<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';

import { computed, onMounted, ref } from 'vue';

import { ProfileBaseSetting } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { getProfile, updateProfile } from '#/api/system/profile';
import { $t } from '#/locales';

import ImageUpload from '../../system/_shared/image-upload.vue';

const profileBaseSettingRef = ref();
const avatar = ref<string>('');

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      fieldName: 'username',
      component: 'Input',
      label: $t('system.user.name'),
      componentProps: { disabled: true },
    },
    {
      fieldName: 'realName',
      component: 'Input',
      label: $t('system.user.realName'),
    },
    {
      fieldName: 'nickname',
      component: 'Input',
      label: $t('system.user.nickname'),
    },
    {
      fieldName: 'gender',
      component: 'RadioGroup',
      label: $t('system.user.gender'),
      componentProps: {
        options: [
          { label: $t('system.user.genderMale'), value: 1 },
          { label: $t('system.user.genderFemale'), value: 2 },
          { label: $t('system.user.genderUnknown'), value: 0 },
        ],
      },
    },
    {
      fieldName: 'phone',
      component: 'Input',
      label: $t('system.user.phone'),
    },
    {
      fieldName: 'email',
      component: 'Input',
      label: $t('system.user.email'),
    },
  ];
});

onMounted(async () => {
  const data = await getProfile();
  avatar.value = data.avatar ?? '';
  profileBaseSettingRef.value?.getFormApi().setValues(data);
});

async function handleSubmit(values: Record<string, any>) {
  await updateProfile({ ...values, avatar: avatar.value });
  message.success($t('common.success'));
}
</script>
<template>
  <div>
    <div class="mb-4 flex flex-col items-center gap-2">
      <ImageUpload
        v-model="avatar"
        module="avatar"
        aspect-ratio="1:1"
        shape="circle"
        :size="88"
      />
      <span class="text-foreground/60 text-xs">{{
        $t('system.user.avatar')
      }}</span>
    </div>
    <ProfileBaseSetting
      ref="profileBaseSettingRef"
      :form-schema="formSchema"
      @submit="handleSubmit"
    />
  </div>
</template>
