<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createDictItem, updateDictItem } from '#/api/system/dictItem';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['reload']);
const isUpdate = ref(false);
const rowId = ref('');
const parentDictId = ref('');

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

      const submitData = {
        ...values,
        dictId: parentDictId.value,
      };

      await (isUpdate.value
        ? updateDictItem(rowId.value, submitData)
        : createDictItem(submitData));

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
      parentDictId.value = data?.dictId || '';

      drawerApi.setState({
        title: isUpdate.value
          ? $t('ui.actionTitle.edit', [$t('system.dictItem.title')])
          : $t('ui.actionTitle.create', [$t('system.dictItem.title')]),
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
