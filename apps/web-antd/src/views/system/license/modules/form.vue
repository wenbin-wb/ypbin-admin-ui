<script lang="ts" setup>
import type { SystemLicenseApi } from '#/api/system/license';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createLicense, updateLicense } from '#/api/system/license';
import { $t } from '#/locales';

import KeyValueInput from '../../_shared/key-value-input.vue';
import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const id = ref<string>();

type LicenseFormData = null | SystemLicenseApi.SystemLicense;

const [Drawer, drawerApi] = useVbenDrawer<LicenseFormData>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    drawerApi.lock();
    (id.value
      ? updateLicense(id.value, values as SystemLicenseApi.LicenseSaveReq)
      : createLicense(values as SystemLicenseApi.LicenseSaveReq)
    )
      .then(() => {
        emits('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },

  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    formApi.reset();
    id.value = data?.id;
    // 等表单字段挂载再回填，否则 setValues 早于初始化会丢值
    await nextTick();
    if (data?.id) {
      formApi.setValues(data);
    }
  },
});

const getDrawerTitle = computed(() =>
  id.value
    ? $t('ui.actionTitle.edit', [$t('system.license.name')])
    : $t('ui.actionTitle.create', [$t('system.license.name')]),
);

defineExpose({ drawerApi });
</script>
<template>
  <Drawer :title="getDrawerTitle" class="w-[720px]">
    <Form>
      <template #quotas="slotProps">
        <KeyValueInput
          v-bind="slotProps.componentField"
          value-type="number"
          :key-placeholder="$t('system.license.modules')"
          :value-placeholder="$t('system.license.quotas')"
        />
      </template>
      <template #attributes="slotProps">
        <KeyValueInput
          v-bind="slotProps.componentField"
          value-type="text"
          :key-placeholder="$t('system.license.modules')"
          :value-placeholder="$t('system.license.attributes')"
        />
      </template>
    </Form>
  </Drawer>
</template>
