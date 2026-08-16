<script lang="ts" setup>
import type { SystemAppApi } from '#/api/system/app';

import { nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createApp, updateApp } from '#/api/system/app';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['reload', 'secret']);
const isUpdate = ref(false);
const rowId = ref('');

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

interface AppFormValues {
  appName: string;
  enabled: number;
  expireTime?: string;
}

type AppFormData = null | SystemAppApi.AppResp;

const [Drawer, drawerApi] = useVbenDrawer<AppFormData>({
  onCancel() {
    drawerApi.close();
  },
  async onConfirm() {
    try {
      drawerApi.setState({ confirmLoading: true });
      const { valid } = await formApi.validate();
      if (!valid) {
        return;
      }
      const values = await formApi.getValues<AppFormValues>();
      const data: SystemAppApi.AppSaveReq = {
        appName: values.appName,
        enabled: values.enabled,
        expireTime: values.expireTime,
      };
      if (isUpdate.value) {
        await updateApp(rowId.value, data);
      } else {
        const credential = await createApp(data);
        emit('secret', credential.secretKey);
      }
      message.success($t('common.success'));
      drawerApi.close();
      emit('reload');
    } finally {
      drawerApi.setState({ confirmLoading: false });
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData();
      isUpdate.value = !!data?.id;
      rowId.value = data?.id ?? '';
      formApi.reset();
      drawerApi.setState({
        title: isUpdate.value
          ? $t('ui.actionTitle.edit', [$t('system.app.name')])
          : $t('ui.actionTitle.create', [$t('system.app.name')]),
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
  <Drawer>
    <Form />
  </Drawer>
</template>
