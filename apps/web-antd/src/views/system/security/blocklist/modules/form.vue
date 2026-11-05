<script lang="ts" setup>
import type { SystemBlocklistApi } from '#/api/system/blocklist';

import { nextTick } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createBlocklist, updateBlocklist } from '#/api/system/blocklist';
import { $t } from '#/locales';

import { matchTypeOptions } from '../data';

const emit = defineEmits(['success']);

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'Select',
      componentProps: {
        options: matchTypeOptions(),
        placeholder: $t('system.blocklist.matchType'),
      },
      fieldName: 'matchType',
      label: $t('system.blocklist.matchType'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        maxlength: 255,
        placeholder: $t('system.blocklist.matchValuePlaceholder'),
      },
      fieldName: 'matchValue',
      label: $t('system.blocklist.matchValue'),
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { maxlength: 255 },
      fieldName: 'reason',
      label: $t('system.blocklist.reason'),
    },
    {
      component: 'DatePicker',
      componentProps: {
        class: 'w-full',
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
      fieldName: 'expireTime',
      label: $t('system.blocklist.expireTime'),
    },
    {
      component: 'RadioGroup',
      componentProps: {
        options: [
          { label: $t('system.blocklist.statusEnabled'), value: 1 },
          { label: $t('system.blocklist.statusDisabled'), value: 0 },
        ],
      },
      defaultValue: 1,
      fieldName: 'status',
      label: $t('system.blocklist.status'),
    },
  ],
  layout: 'horizontal',
  showDefaultActions: false,
});

let isUpdate = false;
let updateId = '';

const [Drawer, drawerApi] =
  useVbenDrawer<null | SystemBlocklistApi.BlocklistResp>({
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
        const values =
          await formApi.getValues<SystemBlocklistApi.BlocklistSaveReq>();
        await (isUpdate
          ? updateBlocklist(updateId, values)
          : createBlocklist(values));
        message.success($t('common.success'));
        emit('success');
        drawerApi.close();
      } finally {
        drawerApi.unlock();
      }
    },
    async onOpenChange(isOpen: boolean) {
      if (!isOpen) {
        return;
      }
      const data = drawerApi.getData();
      isUpdate = !!data?.id;
      updateId = data?.id ?? '';
      formApi.reset();
      drawerApi.setState({
        title: isUpdate
          ? $t('system.blocklist.editTitle')
          : $t('system.blocklist.addTitle'),
      });
      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
    },
  });
</script>
<template>
  <Drawer>
    <Form />
  </Drawer>
</template>
