<script lang="ts" setup>
import type { SystemLogApi } from '#/api/system/log';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Descriptions, DescriptionsItem } from 'ant-design-vue';

import { $t } from '#/locales';

const record = ref<Partial<SystemLogApi.LogResp>>({});

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
    <Descriptions bordered :column="1">
      <DescriptionsItem :label="$t('system.log.description')">
        {{ record.description }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('system.log.module')">
        {{ record.module }}
      </DescriptionsItem>
      <DescriptionsItem label="URI">{{ record.requestUri }}</DescriptionsItem>
      <DescriptionsItem label="IP">{{ record.ip }}</DescriptionsItem>
      <DescriptionsItem :label="$t('system.log.location')">
        {{ record.location }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('system.log.browser')">
        {{ record.browser }}
      </DescriptionsItem>
      <DescriptionsItem label="OS">{{ record.os }}</DescriptionsItem>
      <DescriptionsItem :label="$t('system.log.timeTaken')">
        {{ record.timeTaken }} ms
      </DescriptionsItem>
      <DescriptionsItem label="Request Method">
        {{ record.requestMethod }}
      </DescriptionsItem>
      <DescriptionsItem label="Error Msg" v-if="record.errorMsg">
        <pre class="text-red-500 overflow-auto">{{ record.errorMsg }}</pre>
      </DescriptionsItem>
    </Descriptions>
  </Drawer>
</template>
