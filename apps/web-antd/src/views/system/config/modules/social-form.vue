<script lang="ts" setup>
import type { SystemConfigApi } from '#/api/system/config';

import { computed, nextTick, reactive, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getSocialConfigDetail, updateSocialConfig } from '#/api/system/config';
import { $t } from '#/locales';
import { getSocialPlatformMeta } from '#/utils/social-platform';

const emit = defineEmits<{ success: [] }>();

const source = ref<SystemConfigApi.SocialSource>();

const schema = computed(() => [
  {
    component: 'Switch' as const,
    componentProps: { checkedValue: true, unCheckedValue: false },
    fieldName: 'enabled',
    label: $t('system.config.social.enabled'),
  },
  {
    component: 'Input' as const,
    fieldName: 'clientId',
    label: $t('system.config.social.clientId'),
  },
  {
    component: 'InputPassword' as const,
    componentProps: {
      autocomplete: 'new-password',
      placeholder: $t('system.config.social.clientSecretPlaceholder'),
    },
    fieldName: 'clientSecret',
    help: $t('system.config.social.clientSecretHelp'),
    label: $t('system.config.social.clientSecret'),
  },
  {
    component: 'Input' as const,
    fieldName: 'redirectUri',
    label: $t('system.config.social.redirectUri'),
  },
  ...(source.value === 'alipay'
    ? [
        {
          component: 'Textarea' as const,
          componentProps: { autoSize: { maxRows: 10, minRows: 5 } },
          fieldName: 'publicKey',
          label: $t('system.config.social.publicKey'),
        },
      ]
    : []),
]);

const [Form, formApi] = useVbenForm(
  reactive({
    layout: 'vertical',
    schema,
    showDefaultActions: false,
  }),
);

const [Drawer, drawerApi] = useVbenDrawer<SystemConfigApi.SocialSource>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !source.value) return;

    drawerApi.lock();
    try {
      const values =
        await formApi.getValues<SystemConfigApi.SocialConfigUpdateReq>();
      await updateSocialConfig(source.value, {
        clientId: values.clientId,
        clientSecret: values.clientSecret ?? '',
        enabled: values.enabled,
        publicKey: values.publicKey ?? '',
        redirectUri: values.redirectUri,
      });
      message.success($t('common.success'));
      emit('success');
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;

    source.value = drawerApi.getData();
    if (!source.value) {
      throw new Error('Social platform source is required');
    }
    const platform = getSocialPlatformMeta(source.value);
    drawerApi.setState({
      title: $t('ui.actionTitle.edit', [$t(platform.labelKey)]),
    });
    formApi.reset();
    const detail = await getSocialConfigDetail(source.value);
    await nextTick();
    await formApi.setValues({
      clientId: detail.clientId,
      clientSecret: '',
      enabled: detail.enabled,
      publicKey: detail.publicKey,
      redirectUri: detail.redirectUri,
    });
  },
});

defineExpose({ drawerApi });
</script>

<template>
  <Drawer>
    <Form />
  </Drawer>
</template>
