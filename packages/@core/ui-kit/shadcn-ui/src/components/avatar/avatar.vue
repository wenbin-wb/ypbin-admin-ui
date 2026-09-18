<script setup lang="ts">
import type {
  AvatarFallbackProps,
  AvatarImageProps,
  AvatarRootProps,
} from 'reka-ui';

import type { CSSProperties } from 'vue';

import type { ClassType } from '@vben-core/typings';

import { computed } from 'vue';

import { Avatar, AvatarFallback, AvatarImage } from '../../ui';

interface Props extends AvatarFallbackProps, AvatarImageProps, AvatarRootProps {
  /**
   * 替代文本，同时是「无头像时回退文字」的来源。
   *
   * 允许 `null`：调用方会把后端的可空字段经中间组件透传进来——
   * `apps/web-antd/src/layouts/basic.vue` 的 `:text="userStore.userInfo?.realName"`
   * → `packages/effects/layouts/src/widgets/user-dropdown/user-dropdown.vue` 的
   * `<VbenAvatar :alt="text" />`；`realName` 在 `@vben-core/typings` 里已按后端
   * 实际契约声明为可空（`null | string`，对应 DB 里允许 NULL 的
   * `sys_user.real_name`），本组件负责最后一道归一。
   */
  alt?: null | string;
  class?: ClassType;
  dot?: boolean;
  dotClass?: ClassType;
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  size?: number;
}

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<Props>(), {
  alt: 'avatar',
  as: 'button',
  dot: false,
  dotClass: 'bg-green-500',
  fit: 'cover',
});

const imageStyle = computed<CSSProperties>(() => {
  const { fit } = props;
  if (fit) {
    return { objectFit: fit };
  }
  return {};
});

/**
 * 归一后的 `alt`：`null` 与「未提供」等价，都取默认值 `avatar`（与 `withDefaults` 的默认值保持一致）。
 *
 * `withDefaults` 只兜 `undefined`——显式传入的 `null` 会原样进来，于是渲染期的
 * `null.slice(-2)` 抛出 `Cannot read properties of null (reading 'slice')`
 * （生产环境 chunk `avatar-*.js` 上报的正是这个位置），故这里再归一一次。
 */
const normalizedAlt = computed(() => {
  return props.alt ?? 'avatar';
});

const text = computed(() => {
  return normalizedAlt.value.slice(-2).toUpperCase();
});

const rootStyle = computed(() => {
  return props.size !== undefined && props.size > 0
    ? {
        height: `${props.size}px`,
        width: `${props.size}px`,
      }
    : {};
});
</script>

<template>
  <div
    :class="props.class"
    :style="rootStyle"
    class="relative flex shrink-0 items-center"
  >
    <Avatar :class="props.class" class="size-full">
      <AvatarImage :alt="normalizedAlt" :src="src" :style="imageStyle" />
      <AvatarFallback>{{ text }}</AvatarFallback>
    </Avatar>
    <span
      v-if="dot"
      :class="dotClass"
      class="border-background absolute right-0 bottom-0 size-3 rounded-full border-2"
    >
    </span>
  </div>
</template>
