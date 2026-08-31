<script lang="ts" setup generic="V extends number | string">
import { shallowRef, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

// vben-ui-dev-exempt: R2 动态行键值对录入（Record<string, V> 每行独立 Input/InputNumber），
// useVbenForm schema 无法表达行内集合编辑，属共享复合组件，走表单具名 slot 接入
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

/** 编辑期行数据：组件内独立持有，未填完的空行不落模型，避免「添加一行随即被收敛消失」 */
const rows = shallowRef<Row[]>([]);

// 组件内部回写模型时置位，跳过 watch 重建，否则会把正在编辑的空行冲掉
let internalCommit = false;

/** 由外部赋值（编辑回填 / 外部重置）重建行 */
function syncFromModel() {
  const obj = (modelValue.value ?? {}) as Record<string, V>;
  rows.value = Object.keys(obj).map((key) => ({
    key,
    value: obj[key] as unknown as undefined | V,
  }));
}

watch(
  modelValue,
  () => {
    if (internalCommit) {
      internalCommit = false;
      return;
    }
    syncFromModel();
  },
  { immediate: true },
);

/** 将非空行收敛为对象写回模型 */
function commit() {
  const obj: Record<string, V> = {};
  for (const row of rows.value) {
    const key = row.key.trim();
    if (
      key &&
      row.value !== undefined &&
      row.value !== null &&
      row.value !== ''
    ) {
      obj[key] = row.value as V;
    }
  }
  internalCommit = true;
  modelValue.value = obj;
}

function updateRow(index: number, patch: Partial<Row>) {
  rows.value = rows.value.map((row, i) =>
    i === index ? { ...row, ...patch } : row,
  );
  commit();
}

function addRow() {
  rows.value = [...rows.value, { key: '', value: undefined }];
}

function removeRow(index: number) {
  rows.value = rows.value.filter((_, i) => i !== index);
  commit();
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
        @update:value="(val) => updateRow(index, { value: val as V })"
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
