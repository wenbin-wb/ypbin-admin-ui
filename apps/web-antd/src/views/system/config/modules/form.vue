<script lang="ts" setup>
import type { SystemConfigApi } from '#/api/system/config';

import { nextTick } from 'vue';

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

const [Drawer, drawerApi] = useVbenDrawer<null | SystemConfigApi.ConfigResp>({
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
      const values = await formApi.getValues<{
        configGroup: string;
        configKey: string;
        configValue: string;
        name?: string;
        remark?: string;
      }>();
      const data: SystemConfigApi.ConfigSaveReq = {
        configGroup: values.configGroup,
        configKey: values.configKey,
        configValue: values.configValue,
        name: values.name,
        remark: values.remark,
      };
      await (isUpdate ? updateConfig(updateId, data) : createConfig(data));
      message.success($t('common.success'));
      emit('success');
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData();
      isUpdate = !!data?.id;
      updateId = data?.id ?? '';
      formApi.reset();
      drawerApi.setState({
        title: isUpdate
          ? $t('ui.actionTitle.edit', [$t('system.config.title')])
          : $t('ui.actionTitle.create', [$t('system.config.title')]),
      });
      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
    }
  },
});

defineExpose({ drawerApi });
</script>
<template>
  <Drawer><Form /></Drawer>
</template>
