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
 * 空值占位。
 *
 * 与同模块列表 `views/tracking/events/data.ts`、`views/system/online-user/data.ts`
 * 同一约定：上报方/老数据没带某字段时统一显示短横线，直接留空会让使用者分不清
 * 「这一项没有值」和「这一项没取到」。
 */
const EMPTY_TEXT = '-';

/** 字符串空值 → 占位符（`undefined`/空串；'0' 这类非空字符串照原样展示） */
function toText(value?: null | string): string {
  // 空串同样算缺失，故用 `||` 而不是 `??`
  return value || EMPTY_TEXT;
}

/**
 * 抽屉宽度。
 *
 * `drawer.vue` 的基础宽度是 `w-130`（520px），字段较多时过窄；这里用 `class` 覆盖。
 * 两点已按 `cn()`（`twMerge(clsx(...))`）的实际行为核对：
 * - 宽度类**不能**带 `!`：`w-[800px]!` 会与窄屏自带的 `w-full!` 判为同组冲突，
 *   twMerge 只保留后写的那个（`w-130`/`w-full!` 一并被删），于是手机端（< md）
 *   抽屉被钉成 800px 而溢出屏幕；不带 `!` 时两个类都留下，`w-full!` 靠 `!important`
 *   在窄屏胜出，故保持不带 `!`。
 * - `isMobile` 只在 **< 768px**（`breakpoints.smaller('md')`）成立，768–800px 的窗口下
 *   800px 固定宽度仍会横向溢出，故补 `max-w-[calc(100vw-40px)]` 兜底
 *   （与 `ai/knowledge/modules/documents.vue` 的宽抽屉同款写法）。
 */
const [Drawer, drawerApi] = useVbenDrawer<SystemTrackingApi.TrackEvent>({
  class: 'w-[800px] max-w-[calc(100vw-40px)]',
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

/** 事件码说明；事件码缺失时显示占位符，目录里没有该码时如实标注，不回退成空串 */
const eventDescription = computed(() => {
  const code = record.value.eventCode;
  if (!code) {
    return EMPTY_TEXT;
  }
  return (
    TRACKING_EVENT_CATALOG[code]?.description ??
    $t('tracking.events.unknownEventCode')
  );
});

/** 结果文案；success 为 null（老数据）时显示占位符，不臆造"失败" */
const resultText = computed(() => {
  if (record.value.success === 1) {
    return $t('tracking.events.success');
  }
  if (record.value.success === 0) {
    return $t('tracking.events.fail');
  }
  return EMPTY_TEXT;
});

const durationText = computed(() =>
  record.value.durationMs ? `${record.value.durationMs} ms` : EMPTY_TEXT,
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
        {{ toText(record.eventId) }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.eventCode')">
        {{ toText(record.eventCode) }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.catalog.description')">
        {{ eventDescription }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.appId')">
        {{ toText(record.appId) }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.userId')">
        {{ toText(record.userIdName || record.userId) }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.anonId')">
        {{ toText(record.anonId) }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.sessionId')">
        {{ toText(record.sessionId) }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.traceId')">
        {{ toText(record.traceId) }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.pageUrl')">
        {{ toText(pageTitleText) }}
      </DescriptionsItem>
      <DescriptionsItem
        v-if="showRawPageUrl"
        :label="$t('tracking.events.pageUrlRaw')"
      >
        {{ record.pageUrl }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.referrer')">
        {{ toText(record.referrer) }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.ip')">
        {{ toText(record.ip) }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.userAgent')">
        {{ toText(record.userAgent) }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.durationMs')">
        {{ durationText }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.result')">
        {{ resultText }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.eventTime')">
        {{ toText(record.eventTime) }}
      </DescriptionsItem>
      <DescriptionsItem :label="$t('tracking.events.receivedTime')">
        {{ toText(record.receivedTime) }}
      </DescriptionsItem>
    </Descriptions>

    <div class="mt-4">
      <div class="mb-2 text-sm font-medium">
        {{ $t('tracking.events.payload') }}
      </div>
      <template v-if="hasPayload">
        <div
          v-if="hasTranslatedPayload"
          class="mb-2 text-xs text-muted-foreground"
        >
          {{ $t('tracking.events.payloadI18nHint') }}
        </div>
        <pre
          class="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-3 text-xs leading-relaxed"
          >{{ prettyPayload }}</pre>
      </template>
      <div v-else class="text-sm text-muted-foreground">
        {{ $t('tracking.events.payloadEmpty') }}
      </div>
    </div>
  </Drawer>
</template>
