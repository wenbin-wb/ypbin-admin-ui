<script lang="ts" setup>
import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { SystemConfigApi } from '#/api/system/config';

import { computed, nextTick, reactive, ref, watch } from 'vue';

import { Button, Card, message, Spin } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getConfigGroup, updateConfigBatch } from '#/api/system/config';
import { $t } from '#/locales';

import { isBooleanKey, SPECIAL_FIELDS } from './special-fields';

const props = defineProps<{ configGroup: string }>();

const emit = defineEmits<{ saved: [] }>();

const loading = ref(false);
const saving = ref(false);
const items = ref<SystemConfigApi.ConfigResp[]>([]);

const schema = computed<FormSchema[]>(() =>
  items.value.map((item) => {
    const base: FormSchema = {
      fieldName: item.configKey,
      label: item.name,
      help: item.configKey,
      component: 'Input',
    };
    const special = SPECIAL_FIELDS[item.configKey];
    if (special) {
      return { ...base, ...special };
    }
    if (isBooleanKey(item.configKey) || isBooleanValue(item.configValue)) {
      return {
        ...base,
        component: 'Switch',
        componentProps: { checkedValue: 1, unCheckedValue: 0 },
      };
    }
    if (/^-?\d+$/.test(item.configValue.trim())) {
      return { ...base, component: 'InputNumber' };
    }
    return base;
  }),
);

const [Form, formApi] = useVbenForm(
  reactive({
    layout: 'vertical',
    showDefaultActions: false,
    schema,
  }),
);

async function load() {
  loading.value = true;
  try {
    const list = await getConfigGroup(props.configGroup);
    items.value = list;
    // schema 是响应式 computed，items 变化后表单自动重建字段
    await nextTick();
    await formApi.setValues(
      Object.fromEntries(
        list.map((item) => [
          item.configKey,
          toFormValue(item.configKey, item.configValue),
        ]),
      ),
    );
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  try {
    const values = await formApi.getValues();
    await updateConfigBatch(props.configGroup, values);
    message.success($t('common.success'));
    emit('saved');
    await load();
  } finally {
    saving.value = false;
  }
}

function isBooleanValue(configValue: string): boolean {
  return ['0', '1', 'false', 'true'].includes(configValue.trim().toLowerCase());
}

function toFormValue(configKey: string, configValue: string): number | string {
  if (isBooleanKey(configKey) || isBooleanValue(configValue)) {
    return ['1', 'on', 'true', 'yes'].includes(configValue.trim().toLowerCase())
      ? 1
      : 0;
  }
  return configValue;
}

watch(() => props.configGroup, load, { immediate: true });
</script>
<template>
  <Card :bordered="false" class="config-group-card">
    <Spin :spinning="loading">
      <Form />
    </Spin>
    <div class="pt-4">
      <Button type="primary" :loading="saving" @click="onSave">
        {{ $t('system.config.save') }}
      </Button>
    </div>
  </Card>
</template>
<style scoped>
.config-group-card {
  max-width: 640px;
}
</style>
