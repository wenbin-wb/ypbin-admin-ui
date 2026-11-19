<script lang="ts" setup>
import type { DescriptionsItemType } from '@vben/common-ui';

import type { SystemLogApi } from '#/api/system/log';

import { computed, h, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { $t } from '#/locales';

const record = ref<Partial<SystemLogApi.LogResp>>({});

const items = computed<DescriptionsItemType[]>(() => {
  const list: DescriptionsItemType[] = [
    { label: $t('system.log.description'), content: record.value.description },
    { label: $t('system.log.module'), content: record.value.module },
    { label: $t('system.log.uri'), content: record.value.requestUri },
    { label: $t('system.log.ip'), content: record.value.ip },
    { label: $t('system.log.location'), content: record.value.location },
    { label: $t('system.log.browser'), content: record.value.browser },
    { label: $t('system.log.os'), content: record.value.os },
    {
      label: $t('system.log.timeTaken'),
      content: record.value.timeTaken ? `${record.value.timeTaken} ms` : '',
    },
    {
      label: $t('system.log.requestMethod'),
      content: record.value.requestMethod,
    },
  ];
  if (record.value.errorMsg) {
    list.push({
      label: $t('system.log.errorMsg'),
      content: () =>
        h(
          'pre',
          { class: 'overflow-auto text-red-500' },
          record.value.errorMsg,
        ),
    });
  }
  return list;
});

const [Drawer, drawerApi] = useVbenDrawer<SystemLogApi.LogResp>({
  onCancel() {
    drawerApi.close();
  },
  onConfirm() {
    drawerApi.close();
  },
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      record.value = drawerApi.getData() ?? {};
      drawerApi.setState({ title: $t('common.detail') });
    }
  },
});

defineExpose({ drawerApi });
</script>
<template>
  <Drawer>
    <VbenDescriptions bordered :column="1" :items="items" />
  </Drawer>
</template>
