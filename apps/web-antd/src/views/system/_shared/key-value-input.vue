<script lang="ts" setup generic="V extends number | string">
import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, InputNumber } from 'ant-design-vue';

import { $t } from '#/locales';

/**
 * 键值对录入：v-model 绑定 Record<string, V> 对象。
 * 内部维护成有序行，值类型由 valueType 决定（文本 / 数字）。
 * 用于授权额度限制（number）、扩展参数（string）等场景。
 */
const props = withDefaults(
  defineProps<{
    keyPlaceholder?: string;
    valuePlaceholder?: string;
    /** 值类型：text 文本 / number 数字 */
    valueType?: 'number' | 'text';
  }>(),
  { valueType: 'text', keyPlaceholder: '', valuePlaceholder: '' },
);

const modelValue = defineModel<Record<string, V>>();

interface Row {
  key: string;
  value: undefined | V;
}

/** 对象与有序行的双向映射：编辑期用行保持顺序与空行，回写时收敛为对象 */
const rows = computed<Row[]>({
  get() {
    const obj = modelValue.value ?? {};
    return Object.keys(obj).map((key) => ({ key, value: obj[key] }));
  },
  set(next) {
    const obj: Record<string, V> = {};
    for (const row of next) {
      const key = row.key.trim();
      if (key && row.value !== undefined && (row.value as any) !== '') {
        obj[key] = row.value as V;
      }
    }
    modelValue.value = obj;
  },
});

function updateRow(index: number, patch: Partial<Row>) {
  const next = rows.value.map((row, i) =>
    i === index ? { ...row, ...patch } : row,
  );
  rows.value = next;
}

function addRow() {
  rows.value = [...rows.value, { key: '', value: undefined }];
}

function removeRow(index: number) {
  rows.value = rows.value.filter((_, i) => i !== index);
}
</script>
<template>
  <div class="flex w-full flex-col gap-2">
    <div
      v-for="(row, index) in rows"
      :key="index"
      class="flex items-center gap-2"
    >
      <Input
        :value="row.key"
        :placeholder="keyPlaceholder"
        class="flex-1"
        @update:value="(val: string) => updateRow(index, { key: val })"
      />
      <InputNumber
        v-if="valueType === 'number'"
        :value="row.value as number"
        :placeholder="valuePlaceholder"
        class="flex-1"
        @update:value="(val: any) => updateRow(index, { value: val })"
      />
      <Input
        v-else
        :value="row.value as string"
        :placeholder="valuePlaceholder"
        class="flex-1"
        @update:value="(val: string) => updateRow(index, { value: val as V })"
      />
      <Button type="text" danger @click="removeRow(index)">
        <IconifyIcon icon="lucide:trash-2" class="size-4" />
      </Button>
    </div>
    <div>
      <Button type="dashed" block @click="addRow">
        <IconifyIcon icon="lucide:plus" class="size-4" />
        {{ $t('common.add') }}
      </Button>
    </div>
  </div>
</template>
