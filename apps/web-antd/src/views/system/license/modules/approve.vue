<script lang="ts" setup>
import type { SystemLicenseApi } from '#/api/system/license';

import { nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { approveLicense } from '#/api/system/license';
import { $t } from '#/locales';

import { showLicenseDelivery } from '../../_shared/show-secret';

const emits = defineEmits(['success']);

const id = ref<string>();

const [Form, formApi] = useVbenForm({
  showDefaultActions: false,
  schema: [
    {
      component: 'RadioGroup',
      fieldName: 'approve',
      label: $t('system.license.approveResult'),
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: $t('system.license.approvePass'), value: true },
          { label: $t('system.license.approveReject'), value: false },
        ],
      },
      defaultValue: true,
      rules: 'required',
    },
    {
      component: 'Textarea',
      fieldName: 'rejectReason',
      label: $t('system.license.rejectReason'),
      componentProps: {
        placeholder: $t('system.license.rejectReasonPlaceholder'),
      },
      // 仅驳回时显示并要求必填
      dependencies: {
        triggerFields: ['approve'],
        show: (values) => values.approve === false,
        rules: (values) => (values.approve === false ? 'required' : null),
      },
    },
  ],
});

const [Modal, modalApi] = useVbenModal<SystemLicenseApi.SystemLicense>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    if (!id.value) return;
    modalApi.lock();
    approveLicense(id.value, values as SystemLicenseApi.ApproveParams)
      .then((issue) => {
        if (issue) {
          showLicenseDelivery(issue, $t('system.license.deliveryTitle'));
        }
        emits('success');
        modalApi.close();
      })
      .catch(() => {
        modalApi.unlock();
      });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = modalApi.getData();
    formApi.reset();
    id.value = data?.id;
    await nextTick();
    formApi.setValues({ approve: true });
  },
});

defineExpose({ modalApi });
</script>
<template>
  <Modal :title="$t('system.license.approveTitle')" class="w-[560px]">
    <Form class="mx-4" />
  </Modal>
</template>
