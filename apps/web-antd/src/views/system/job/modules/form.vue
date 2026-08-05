<script lang="ts" setup>
import { nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createJob, updateJob } from '#/api/system/job';
import { $t } from '#/locales';

import CronInput from '../../_shared/cron-input.vue';
import { useFormSchema } from '../data';

const emit = defineEmits(['reload']);
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
      await (isUpdate.value
        ? updateJob(rowId.value, values)
        : createJob(values));
      message.success($t('common.success'));
      drawerApi.close();
      emit('reload');
    } finally {
      drawerApi.setState({ confirmLoading: false });
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData<Record<string, any>>();
      isUpdate.value = !!data?.isUpdate;
      drawerApi.setState({
        title: isUpdate.value ? $t('common.edit') : $t('common.add'),
      });
      // 等表单挂载就绪再回填/重置，避免重开时 setValues 早于表单初始化
      await nextTick();
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
  <Drawer class="w-[700px]">
    <Form>
      <template #cron="slotProps">
        <CronInput v-bind="slotProps.componentField" />
      </template>
    </Form>
  </Drawer>
</template>
