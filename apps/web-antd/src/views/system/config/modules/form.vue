<script lang="ts" setup>
import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createConfig, updateConfig } from '#/api/system/config';
import { $t } from '#/locales';

const emit = defineEmits(['success']);

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'Input',
      fieldName: 'configGroup',
      label: $t('system.config.configGroup'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.config.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'configKey',
      label: $t('system.config.configKey'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'configValue',
      label: $t('system.config.configValue'),
      rules: 'required',
    },
    {
      component: 'InputTextArea',
      fieldName: 'remark',
      label: $t('system.config.remark'),
    },
  ],
  showDefaultActions: false,
  layout: 'horizontal',
});

let isUpdate = false;
let updateId = '';

const [Drawer, drawerApi] = useVbenDrawer({
  onCancel() {
    drawerApi.close();
  },
  async onConfirm() {
    try {
      drawerApi.lock();
      const { valid } = await formApi.validate();
      if (!valid) {
        return;
      }
      const values = await formApi.getValues();
      await (isUpdate ? updateConfig(updateId, values) : createConfig(values));
      message.success($t('common.success'));
      emit('success');
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData<any>();
      isUpdate = !!data?.id;
      updateId = data?.id;
      formApi.setValues(data || {});
      drawerApi.setState({
        title: isUpdate
          ? $t('ui.actionTitle.edit', [$t('system.config.title')])
          : $t('ui.actionTitle.create', [$t('system.config.title')]),
      });
    }
  },
});
</script>
<template>
  <Drawer><Form /></Drawer>
</template>
