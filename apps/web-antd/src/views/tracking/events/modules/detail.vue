<script lang="ts" setup>
import type { SystemTrackingApi } from '#/api/system/tracking';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { TRACKING_EVENT_CATALOG } from '@vben/tracking';

import { Descriptions, DescriptionsItem } from 'ant-design-vue';

import { $t } from '#/locales';

import { humanizePayload, translatePayloadValue } from '../payload';
import { usePageTitle } from '../use-page-title';

const record = ref<Partial<SystemTrackingApi.TrackEvent>>({});

/**
 * 抽屉宽度。
 *
 * `drawer.vue` 的基础宽度是 `w-130`（520px），字段较多时过窄；这里用 `class` 覆盖。
 * **不能**写成 `w-[800px]!`：`cn()` 是 `twMerge(clsx(...))`，两个宽度类同为 `!important` 时
 * twMerge 会**保留后写的那个、删掉窄屏自带的 `w-full!`**，手机端抽屉因此变成 800px 溢出，
 * 从而把窄屏（< md）下抽屉自己的 `w-full!` 顶掉、在手机上溢出屏幕。
 */
const [Drawer, drawerApi] = useVbenDrawer<SystemTrackingApi.TrackEvent>({
  class: 'w-[800px]',
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

/** 页面地址 → 菜单标题；未命中菜单树时回退原始地址 */
const { pageTitle } = usePageTitle();

const pageTitleText = computed(() => pageTitle(record.value.pageUrl));

/** 命中菜单标题时额外展示原始地址，便于排查（两者相同则无需重复展示） */
const showRawPageUrl = computed(
  () => !!record.value.pageUrl && pageTitleText.value !== record.value.pageUrl,
);

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
 *
 * 展示前先过 `humanizePayload`：上报方会把 i18n key 当普通字符串塞进 payload
 * （如 `routeTitle: "tracking.events.title"`），直接展示等于让使用者看 key。
 */
const prettyPayload = computed(() =>
  JSON.stringify(humanizePayload(record.value.payload), null, 2),
);

const hasPayload = computed(
  () => Object.keys(record.value.payload ?? {}).length > 0,
);

/**
 * 是否真的有属性值被翻译过。
 *
 * 说明文案只在「括号里的原始 key」确实出现时才展示——否则对绝大多数 payload
 * 都是一句用不上的噪音。
 */
const hasTranslatedPayload = computed(() =>
  Object.values(record.value.payload ?? {}).some(
    (value) => translatePayloadValue(value) !== value,
  ),
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
        {{ pageTitleText }}
      </DescriptionsItem>
      <DescriptionsItem
        v-if="showRawPageUrl"
        :label="$t('tracking.events.pageUrlRaw')"
      >
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
      <template v-if="hasPayload">
        <div
          v-if="hasTranslatedPayload"
          class="mb-2 text-xs text-gray-500 dark:text-gray-400"
        >
          {{ $t('tracking.events.payloadI18nHint') }}
        </div>
        <pre
          class="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-3 text-xs leading-relaxed"
          >{{ prettyPayload }}</pre>
      </template>
      <div v-else class="text-sm text-gray-500 dark:text-gray-400">
        {{ $t('tracking.events.payloadEmpty') }}
      </div>
    </div>
  </Drawer>
</template>
