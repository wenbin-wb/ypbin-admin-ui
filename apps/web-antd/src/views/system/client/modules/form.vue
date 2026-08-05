<script lang="ts" setup>
import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createClient, updateClient } from '#/api/system/client';
import { $t } from '#/locales';

const emit = defineEmits(['success', 'secret']);

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'Input',
      fieldName: 'clientId',
      label: $t('system.client.clientId'),
      rules: 'required',
    },
    {
      component: 'Select',
      fieldName: 'clientType',
      label: $t('system.client.clientType'),
      rules: 'required',
      componentProps: {
        options: [
          { label: 'WEB', value: 'WEB' },
          { label: 'APP', value: 'APP' },
          { label: 'MINI', value: 'MINI' },
          { label: 'API', value: 'API' },
        ],
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'timeout',
      label: $t('system.client.timeout'),
    },
    {
      component: 'InputTextArea',
      fieldName: 'remark',
      label: $t('system.client.remark'),
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
      if (isUpdate) {
        await updateClient(updateId, values);
      } else {
        const secret = await createClient(values);
        // 新建成功后把后端生成的密钥抛给列表页展示一次
        emit('secret', secret);
      }
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
          ? $t('ui.actionTitle.edit', [$t('system.client.title')])
          : $t('ui.actionTitle.create', [$t('system.client.title')]),
      });
    }
  },
});
</script>
<template>
  <Drawer><Form /></Drawer>
</template>
