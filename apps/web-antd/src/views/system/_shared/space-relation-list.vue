<script lang="ts" setup>
/**
 * 空间关联列表（纯展示）：加载态 / 失败提示 / 空态 / 行渲染只保留这一份。
 *
 * **为什么抽出来**：对象侧面板（`space-relation-panel.vue`）与空间侧抽屉
 * （`space/modules/relation-drawer.vue`）此前逐字复制了同一套状态机与行渲染，
 * 于是同一个缺陷（失败提示重复）在两处各犯一次。这里只保留「列表长什么样」，
 * 列表项主体/标签/副标题由调用方用插槽决定，解绑动作由父组件处理（含二次确认）。
 *
 * @example 对象侧
 * ```vue
 * <SpaceRelationList :items="relations" :loading="loading" :error="loadError"
 *   @unbind="confirmRemove" />
 * ```
 */
import type { SystemSpaceApi } from '#/api/system/space';

import { Button, Empty, Spin, Tag } from 'ant-design-vue';

import { $t } from '#/locales';

interface Props {
  /** 关联列表 */
  items: SystemSpaceApi.SpaceRelationResp[];
  /** 加载中 */
  loading?: boolean;
  /** 加载失败文案（空串表示无错误） */
  error?: string;
  /** 只读（不显示解绑按钮） */
  readonly?: boolean;
  /** 主空间 Tag 颜色；对象侧用 blue、空间侧用 orange */
  primaryColor?: string;
  /** 解绑按钮文案；缺省用「删除」 */
  unbindText?: string;
}

withDefaults(defineProps<Props>(), {
  error: '',
  loading: false,
  primaryColor: 'blue',
  readonly: false,
  unbindText: undefined,
});

defineEmits<{ unbind: [item: SystemSpaceApi.SpaceRelationResp] }>();
</script>

<template>
  <Spin :spinning="loading">
    <div v-if="error" class="mb-2 text-sm text-destructive-text">
      {{ error }}
    </div>

    <Empty
      v-if="items.length === 0 && !loading"
      :description="$t('system.space.noRelation')"
    />
    <div v-else class="flex flex-col gap-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-center justify-between rounded border border-solid px-3 py-2"
      >
        <div class="flex min-w-0 flex-col">
          <div class="flex items-center gap-2">
            <slot name="title" :item="item">
              <span class="truncate font-medium">
                {{ item.spacePath || item.spaceName }}
              </span>
            </slot>
            <Tag v-if="item.isPrimary === 1" :color="primaryColor">
              {{ $t('system.space.primary') }}
            </Tag>
            <slot name="tags" :item="item"></slot>
          </div>
          <slot name="subtitle" :item="item"></slot>
        </div>
        <Button
          v-if="!readonly"
          danger
          size="small"
          type="link"
          @click="$emit('unbind', item)"
        >
          {{ unbindText ?? $t('common.delete') }}
        </Button>
      </div>
    </div>
  </Spin>
</template>
