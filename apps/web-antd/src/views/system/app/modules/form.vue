<script lang="ts" setup>
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

const [Drawer, drawerApi] = useVbenDrawer({
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
      const data = drawerApi.getData<Record<string, any>>();
      isUpdate.value = !!data?.isUpdate;
      drawerApi.setState({
        title: isUpdate.value ? $t('common.edit') : $t('common.add'),
      });
      if (isUpdate.value && data?.row) {
        rowId.value = data.row.id;
        formApi.setValues(data.row);
      } else {
        rowId.value = '';
        formApi.resetForm();
      }
    }
  },
});
</script>
<template>
  <Drawer>
    <Form />
  </Drawer>
</template>
