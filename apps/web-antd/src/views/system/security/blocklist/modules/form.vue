<script lang="ts" setup>
import type { SystemBlocklistApi } from '#/api/system/blocklist';

import { nextTick } from 'vue';

import { useVbenDrawer, z } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createBlocklist, updateBlocklist } from '#/api/system/blocklist';
import { $t } from '#/locales';

import { matchTypeOptions } from '../data';
import { isValidMatchValue } from '../validators';

const emit = defineEmits(['success']);

const MATCH_VALUE_ERROR_KEY: Record<SystemBlocklistApi.MatchType, string> = {
  CIDR: 'system.blocklist.invalidCidr',
  IP: 'system.blocklist.invalidIp',
  PATH: 'system.blocklist.invalidPath',
  USER_AGENT: 'system.blocklist.invalidUserAgent',
};

function matchValueRules(values: Record<string, any>) {
  const type = values.matchType as SystemBlocklistApi.MatchType | undefined;
  const message = type
    ? $t(MATCH_VALUE_ERROR_KEY[type])
    : $t('system.blocklist.matchValue');
  return z
    .string({ error: message })
    .trim()
    .min(1, $t('system.blocklist.matchValue'))
    .refine((value) => !!type && isValidMatchValue(type, value), message);
}

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
      dependencies: {
        rules: matchValueRules,
        triggerFields: ['matchType'],
      },
      fieldName: 'matchValue',
      label: $t('system.blocklist.matchValue'),
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
          ? $t('ui.actionTitle.edit', [$t('system.blocklist.name')])
          : $t('ui.actionTitle.create', [$t('system.blocklist.name')]),
      });
      await nextTick();
      if (data) {
        formApi.setValues(data);
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
