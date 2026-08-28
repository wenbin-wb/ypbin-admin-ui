<script lang="ts" setup>
import type { SystemTenantApi } from '#/api/system/tenant';

import { nextTick } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createTenant, updateTenant } from '#/api/system/tenant';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['reload']);

interface TenantFormValues {
  code: string;
  contactName?: string;
  contactPhone?: string;
  expireDate?: string;
  name: string;
  remark?: string;
  templateId?: string;
}

type TenantFormData = null | SystemTenantApi.TenantResp;

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
      const values = await formApi.getValues<TenantFormValues>();
      const request: SystemTenantApi.TenantSaveReq = {
        code: values.code,
        contactName: values.contactName,
        contactPhone: values.contactPhone,
        expireDate: values.expireDate,
        name: values.name,
        remark: values.remark,
        templateId: values.templateId,
      };
      const data = drawerApi.getData();
      await (data?.id ? updateTenant(data.id, request) : createTenant(request));
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
      formApi.reset();
      drawerApi.setState({
        title: data?.id
          ? $t('ui.actionTitle.edit', [$t('system.tenant.name')])
          : $t('ui.actionTitle.create', [$t('system.tenant.name')]),
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
