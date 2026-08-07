<script lang="ts" setup>
import type { SystemAppApi } from '#/api/system/app';

import { ref } from 'vue';

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

type AppFormData =
  | { isUpdate: false }
  | { isUpdate: true; row: SystemAppApi.AppResp };

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
      const values = await formApi.getValues();
      if (isUpdate.value) {
        await updateApp(rowId.value, values);
      } else {
        const secret = await createApp(values);
        emit('secret', secret);
      }
      message.success($t('common.success'));
      drawerApi.close();
      emit('reload');
    } finally {
      drawerApi.setState({ confirmLoading: false });
    }
  },
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData();
      isUpdate.value = !!data?.isUpdate;
      drawerApi.setState({
        title: isUpdate.value
          ? $t('ui.actionTitle.edit', [$t('system.app.title')])
          : $t('ui.actionTitle.create', [$t('system.app.title')]),
      });
      if (data?.isUpdate) {
        rowId.value = data.row.id;
        formApi.setValues(data.row);
      } else {
        rowId.value = '';
        formApi.reset();
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
