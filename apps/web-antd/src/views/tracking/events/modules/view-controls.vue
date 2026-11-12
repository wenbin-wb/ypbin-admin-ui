<script lang="ts" setup>
import { Download } from '@vben/icons';

import { Button, Segmented, Switch } from 'ant-design-vue';

import { $t } from '#/locales';

defineProps<{ exportLoading: boolean }>();
const emit = defineEmits<{ export: [] }>();
/**
 * 明细/事件流切换、自动刷新与导出。
 *
 * <p>表格视图放在网格的 toolbar 插槽里，事件流视图没有网格，需要在页面级工具栏再放一份；
 * 抽成组件避免两处配置漂移。</p>
 */
const viewMode = defineModel<string>('viewMode', { required: true });
const autoRefresh = defineModel<boolean>('autoRefresh', { required: true });

</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <Segmented
      v-model:value="viewMode"
      :options="[
        { label: $t('tracking.events.tableView'), value: 'table' },
        { label: $t('tracking.events.streamView'), value: 'stream' },
      ]"
    />
    <div class="flex items-center gap-2 text-sm">
      <Switch v-model:checked="autoRefresh" size="small" />
      <span class="text-muted-foreground">
        {{ $t('tracking.events.autoRefresh') }}
      </span>
    </div>
    <Button
      v-access:code="['system:track:export']"
      :loading="exportLoading"
      @click="emit('export')"
    >
      <Download class="mr-1 size-4" />
      {{ $t('tracking.events.export') }}
    </Button>
  </div>
</template>
