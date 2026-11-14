<script lang="ts" setup>
import type { SystemClientApi } from '#/api/system/client';

import { nextTick } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createClient, updateClient } from '#/api/system/client';
import { $t } from '#/locales';

const emit = defineEmits(['success']);

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

const [Drawer, drawerApi] = useVbenDrawer<null | SystemClientApi.ClientResp>({
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
        clientId: string;
        clientType: string;
        remark?: string;
        timeout?: number;
      }>();
      const data: SystemClientApi.ClientSaveReq = {
        clientId: values.clientId,
        clientType: values.clientType,
        remark: values.remark,
        timeout: values.timeout,
      };
      // 新建默认不生成密钥：需要密钥的客户端由列表里的「重置密钥」显式开启
      await (isUpdate ? updateClient(updateId, data) : createClient(data));
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
          ? $t('ui.actionTitle.edit', [$t('system.client.name')])
          : $t('ui.actionTitle.create', [$t('system.client.name')]),
      });
      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
      // 默认客户端的 clientId 是未声明身份登录的兜底入口，改名会直接锁死全站登录
      formApi.updateSchema([
        {
          componentProps: { disabled: !!data?.defaultClient },
          fieldName: 'clientId',
        },
      ]);
    }
  },
});

defineExpose({ drawerApi });
</script>
<template>
  <Drawer><Form /></Drawer>
</template>
