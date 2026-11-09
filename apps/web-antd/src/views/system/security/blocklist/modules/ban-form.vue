<script lang="ts" setup>
import { nextTick } from 'vue';

import { useVbenModal, z } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { banBlocklistIp } from '#/api/system/blocklist';
import { $t } from '#/locales';

import { isValidIp } from '../validators';

interface BanFormValues {
  banMinutes: number;
  clientIp: string;
  reason?: string;
}

const emit = defineEmits(['success']);

const [Form, formApi] = useVbenForm({
  showDefaultActions: false,
  schema: [
    {
      component: 'Input',
      componentProps: {
        maxlength: 64,
        placeholder: '10.0.0.1 / 2001:db8::1',
      },
      fieldName: 'clientIp',
      label: $t('system.blocklist.banIp'),
      rules: z
        .string({ error: $t('system.blocklist.banIp') })
        .trim()
        .min(1, $t('system.blocklist.banIp'))
        .refine((value) => isValidIp(value), $t('system.blocklist.invalidIp')),
    },
    {
      component: 'InputNumber',
      componentProps: {
        class: 'w-full',
        max: 43_200,
        min: 1,
        precision: 0,
      },
      defaultValue: 60,
      fieldName: 'banMinutes',
      label: $t('system.blocklist.banDuration'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 255,
        placeholder: $t('system.blocklist.banReasonPlaceholder'),
      },
      fieldName: 'reason',
      label: $t('system.blocklist.banReason'),
    },
  ],
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    const values = await formApi.getValues<BanFormValues>();
    modalApi.lock();
    try {
      await banBlocklistIp({
        banSeconds: values.banMinutes * 60,
        clientIp: values.clientIp.trim(),
        reason: values.reason,
      });
      message.success($t('common.success'));
      emit('success');
      modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      return;
    }
    formApi.reset();
    await nextTick();
    formApi.setValues({ banMinutes: 60 });
  },
});

defineExpose({ modalApi });
</script>
<template>
  <Modal :title="$t('system.blocklist.banTitle')" class="w-[520px]">
    <Form class="mx-4" />
  </Modal>
</template>
