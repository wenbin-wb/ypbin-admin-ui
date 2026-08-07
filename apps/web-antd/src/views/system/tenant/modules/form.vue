<script lang="ts" setup>
import type { SystemTenantApi } from '#/api/system/tenant';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createTenant, updateTenant } from '#/api/system/tenant';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['reload']);

type TenantFormData =
  | { id: string; isUpdate: true; row: SystemTenantApi.TenantResp }
  | { isUpdate: false };

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<TenantFormData>({
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
      const data = drawerApi.getData();
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
      const data = drawerApi.getData();
      drawerApi.setState({
        title: data?.isUpdate
          ? $t('ui.actionTitle.edit', [$t('system.tenant.title')])
          : $t('ui.actionTitle.create', [$t('system.tenant.title')]),
      });
      if (data?.isUpdate) {
        formApi.setValues(data.row);
      } else {
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
