<script setup lang="ts">
import type { TreeProps } from '@vben-core/shadcn-ui';

import { computed } from 'vue';

import { Inbox } from '@vben/icons';
import { $t } from '@vben/locales';

import { treePropsDefaults, VbenTree } from '@vben-core/shadcn-ui';

const props = withDefaults(defineProps<TreeProps>(), treePropsDefaults());

// 未显式传入时，用通用国际化文案兜底全部展开/收起操作的无障碍名称
const mergedProps = computed(() => ({
  ...props,
  collapseAllLabel: props.collapseAllLabel ?? $t('ui.tree.collapseAll'),
  expandAllLabel: props.expandAllLabel ?? $t('ui.tree.expandAll'),
}));
</script>

<template>
  <VbenTree v-if="props.treeData?.length > 0" v-bind="mergedProps">
    <template v-for="(_, key) in $slots" :key="key" #[key]="slotProps">
      <slot :name="key" v-bind="slotProps"> </slot>
    </template>
  </VbenTree>
  <div
    v-else
    class="flex-col-center cursor-pointer rounded-lg border p-10 text-sm font-medium text-muted-foreground"
  >
    <Inbox class="size-10" />
    <div class="mt-1">{{ $t('common.noData') }}</div>
  </div>
</template>
