<script lang="ts" setup>
import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { SystemConfigApi } from '#/api/system/config';

import {
  computed,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  message,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getConfigGroup, updateConfigBatch } from '#/api/system/config';
import { $t } from '#/locales';

import { isBooleanKey, isSensitiveKey, SPECIAL_FIELDS } from './special-fields';

const props = defineProps<{ configGroup: string }>();

const emit = defineEmits<{ saved: [] }>();

const loading = ref(false);
const saving = ref(false);
const items = ref<SystemConfigApi.ConfigResp[]>([]);
const initialValues = ref<Record<string, string>>({});
const searchKeyword = ref('');
const isDirty = ref(false);

// 敏感字段类型标签（key 特征 → 标签）
function sensitiveLabel(configKey: string): null | string {
  if (configKey.includes('PASSWORD') || configKey.includes('SECRET')) {
    return $t('system.config.sensitive.secret');
  }
  if (configKey.includes('KEY') || configKey.includes('TOKEN')) {
    return $t('system.config.sensitive.key');
  }
  return null;
}

// 过滤后的参数（支持搜索）
const filteredItems = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return items.value;
  return items.value.filter(
    (item) =>
      item.name?.toLowerCase().includes(kw) ||
      item.configKey.toLowerCase().includes(kw) ||
      item.remark?.toLowerCase().includes(kw),
  );
});

const schema = computed<FormSchema[]>(() =>
  filteredItems.value.map((item) => {
    const base: FormSchema = {
      fieldName: item.configKey,
      label: item.name || item.configKey,
      help: item.configKey,
      component: 'Input',
      // 后缀放复制按钮（用 h() 生成 VNode，避免 JSX）
      suffix: () =>
        h(Tooltip, { title: $t('system.config.copyKey') }, () => [
          h(
            'span',
            {
              class: 'cursor-pointer text-muted-foreground hover:text-primary',
              onClick: (e: MouseEvent) => {
                e.stopPropagation();
                void copyKey(item.configKey);
              },
            },
            [h(IconifyIcon, { icon: 'lucide:copy', class: 'size-3.5' })],
          ),
        ]),
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
    // 敏感字段用密码框
    if (isSensitiveKey(item.configKey)) {
      return { ...base, component: 'InputPassword' };
    }
    return base;
  }),
);

const [Form, formApi] = useVbenForm(
  reactive({
    layout: 'vertical',
    showDefaultActions: false,
    schema,
    handleValuesChange: () => {
      isDirty.value = true;
    },
  }),
);

async function copyKey(configKey: string) {
  try {
    await navigator.clipboard.writeText(configKey);
    message.success($t('system.config.copied'));
  } catch {
    message.error($t('common.requestFailed'));
  }
}

function hasUnsavedChanges(): boolean {
  return isDirty.value;
}

// 离开/刷新前未保存提示
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (hasUnsavedChanges()) {
    e.preventDefault();
  }
}

async function load() {
  loading.value = true;
  try {
    const list = await getConfigGroup(props.configGroup);
    items.value = list;
    await nextTick();
    const values = Object.fromEntries(
      list.map((item) => [
        item.configKey,
        toFormValue(item.configKey, item.configValue),
      ]),
    );
    // 整体替换初始值快照（统一转字符串存储）
    initialValues.value = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, String(v)]),
    );
    await formApi.setValues(values);
    isDirty.value = false;
  } finally {
    loading.value = false;
  }
}

async function onSave() {
  saving.value = true;
  try {
    const values = await formApi.getValues();
    const normalized = Object.fromEntries(
      Object.entries(values as Record<string, number | string>).map(
        ([key, val]) => [key, String(val)],
      ),
    );
    await updateConfigBatch(props.configGroup, normalized);
    message.success($t('common.success'));
    emit('saved');
    isDirty.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}

// 恢复初始值
async function onReset() {
  await formApi.resetForm();
  await formApi.setValues({ ...initialValues.value });
  isDirty.value = false;
  message.success($t('system.config.resetDone'));
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
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload));
onBeforeUnmount(() =>
  window.removeEventListener('beforeunload', onBeforeUnload),
);
</script>

<template>
  <div class="group-config">
    <!-- 参数概览 + 搜索 -->
    <div class="group-config__toolbar">
      <Space size="small" wrap>
        <Tag color="blue">
{{
          $t('system.config.totalCount', [items.length])
        }}
</Tag>
        <Tag v-if="searchKeyword" color="green">
          {{ $t('system.config.filteredCount', [filteredItems.length]) }}
        </Tag>
        <Alert
          v-if="sensitiveLabel(items[0]?.configKey || '')"
          type="warning"
          show-icon
          class="group-config__sensitive-hint"
          :message="$t('system.config.sensitive.hint')"
        />
      </Space>
      <Input
        v-model:value="searchKeyword"
        :placeholder="$t('system.config.searchPlaceholder')"
        allow-clear
        class="group-config__search"
      >
        <template #prefix>
          <IconifyIcon
            icon="lucide:search"
            class="size-4 text-muted-foreground"
          />
        </template>
      </Input>
    </div>

    <Card :bordered="false" class="config-group-card">
      <Spin :spinning="loading">
        <Empty
          v-if="!loading && filteredItems.length === 0"
          :description="$t('system.config.noMatch')"
        />
        <Form v-else />
      </Spin>
      <div class="pt-4">
        <Space>
          <Button
            v-access:code="['system:config:edit']"
            type="primary"
            :loading="saving"
            @click="onSave"
          >
            {{ $t('system.config.save') }}
          </Button>
          <Popconfirm
            :title="$t('system.config.resetConfirm')"
            @confirm="onReset"
          >
            <Button>{{ $t('system.config.reset') }}</Button>
          </Popconfirm>
        </Space>
      </div>
    </Card>
  </div>
</template>

<style scoped>
.group-config__toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.group-config__search {
  max-width: 280px;
}

.group-config__sensitive-hint {
  max-width: 480px;
}

.config-group-card {
  max-width: 720px;
}
</style>
