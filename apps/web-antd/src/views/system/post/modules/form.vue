<script lang="ts" setup>
import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createPost, updatePost } from '#/api/system/post';
import { $t } from '#/locales';

const emit = defineEmits(['success']);

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.post.name'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'code',
      label: $t('system.post.code'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'sort',
      label: $t('system.post.sort'),
      defaultValue: 0,
    },
    {
      component: 'RadioGroup',
      fieldName: 'status',
      label: $t('system.post.status'),
      defaultValue: 1,
      componentProps: {
        options: [
          { label: $t('system.post.statusNormal'), value: 1 },
          { label: $t('system.post.statusDisabled'), value: 0 },
        ],
      },
    },
    { component: 'Textarea', fieldName: 'remark', label: $t('common.remark') },
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
      await (isUpdate ? updatePost(updateId, values) : createPost(values));
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
          ? $t('system.post.editTitle')
          : $t('system.post.addTitle'),
      });
    }
  },
});
</script>
<template>
  <Drawer>
    <Form />
  </Drawer>
</template>
