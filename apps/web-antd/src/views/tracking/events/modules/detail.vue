<script lang="ts" setup>
import type { SystemTrackingApi } from '#/api/system/tracking';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { TRACKING_EVENT_CATALOG } from '@vben/tracking';

import { Descriptions, DescriptionsItem } from 'ant-design-vue';

import { $t } from '#/locales';

const record = ref<Partial<SystemTrackingApi.TrackEvent>>({});

const [Drawer, drawerApi] = useVbenDrawer<SystemTrackingApi.TrackEvent>({
  onCancel() {
    drawerApi.close();
  },
  onConfirm() {
    drawerApi.close();
  },
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      record.value = drawerApi.getData() ?? {};
      drawerApi.setState({ title: $t('tracking.events.detailTitle') });
    }
  },
});

defineExpose({ drawerApi });

/** 事件码说明；目录里没有该码时如实标注，不回退成空串 */
const eventDescription = computed(() => {
  const code = record.value.eventCode;
  if (!code) {
    return '';
  }
  return (
    TRACKING_EVENT_CATALOG[code]?.description ??
    $t('tracking.events.unknownEventCode')
  );
});

/** 结果文案；success 为 null（老数据）时留空，不臆造"失败" */
const resultText = computed(() => {
  if (record.value.success === 1) {
    return $t('tracking.events.success');
  }
  if (record.value.success === 0) {
    return $t('tracking.events.fail');
  }
  return '';
});

const durationText = computed(() =>
  record.value.durationMs ? `${record.value.durationMs} ms` : '',
);

/**
 * payload 美化展示。
 *
 * 后端保证 payload 是已裁剪的白名单键值对；这里用 `JSON.stringify(…, 2)` 展开——
 * 属性值可能较长（如 errorMessage/stackDigest 上限 512 字符），故模板里用
 * `whitespace-pre-wrap break-all` 换行而不是横向溢出。
 */
const prettyPayload = computed(() =>
  JSON.stringify(record.value.payload ?? {}, null, 2),
);

const hasPayload = computed(
  () => Object.keys(record.value.payload ?? {}).length > 0,
);
</script>

<template>
  <Drawer>
    <Descriptions bordered size="small" :column="1">
      <DescriptionsItem :label="$t('tracking.events.eventId')">
        {{ record.eventId }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.eventCode')">
        {{ record.eventCode }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.catalog.description')">
        {{ eventDescription }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.appId')">
        {{ record.appId }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.userId')">
        {{ record.userIdName || record.userId }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.anonId')">
        {{ record.anonId }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.sessionId')">
        {{ record.sessionId }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.traceId')">
        {{ record.traceId }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.pageUrl')">
        {{ record.pageUrl }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.referrer')">
        {{ record.referrer }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.ip')">
        {{ record.ip }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.userAgent')">
        {{ record.userAgent }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.durationMs')">
        {{ durationText }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.result')">
        {{ resultText }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.eventTime')">
        {{ record.eventTime }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.receivedTime')">
        {{ record.receivedTime }}
      </DescriptionsItem>
    </Descriptions>

    <div class="mt-4">
      <div class="mb-2 text-sm font-medium">
        {{ $t('tracking.events.payload') }}
      </div>
      <div v-if="hasPayload">
        <pre
          class="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-3 text-xs leading-relaxed"
          >{{ prettyPayload }}</pre>
      </div>
      <div v-else class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('tracking.events.payloadEmpty') }}
      </div>
    </div>
  </Drawer>
</template>
