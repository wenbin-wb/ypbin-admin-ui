<script lang="ts" setup>
import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createTenant, updateTenant } from '#/api/system/tenant';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['reload']);

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
      const data = drawerApi.getData<Record<string, any>>();
      await (data?.isUpdate
        ? updateTenant(data.id, values)
        : createTenant(values));
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
      drawerApi.setState({
        title: data?.isUpdate ? $t('common.edit') : $t('common.add'),
      });
      if (data?.isUpdate && data?.row) {
        formApi.setValues(data.row);
      } else {
        formApi.reset();
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
