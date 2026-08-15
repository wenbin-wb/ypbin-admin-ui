<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { onMounted, ref } from 'vue';

import { message } from 'ant-design-vue';

import {
  createModel,
  deleteModel,
  listModels,
  setDefaultModel,
  testModel,
  updateModel,
} from '#/api/ai';
import { $t } from '#/locales';

defineOptions({ name: 'AiConfig' });

const modelList = ref<AiApi.ModelConfig[]>([]);
const drawerOpen = ref(false);
const editingId = ref<string>('');
const saving = ref(false);
const testing = ref<string>('');

const form = ref<AiApi.ModelConfigSaveReq>({
  name: '',
  provider: 'deepseek',
  apiKey: '',
  baseUrl: '',
  modelName: 'deepseek-v4-flash',
  remark: '',
});

const providerOptions = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'ollama', label: 'Ollama（本地）' },
  { value: 'custom', label: '自定义' },
];

/** 不同提供商的默认模型名提示 */
const defaultModelHints: Record<string, string> = {
  deepseek: 'deepseek-v4-flash / deepseek-v4-pro',
  openai: 'gpt-5.6 / gpt-5.6-terra / gpt-5.6-luna',
  ollama: 'llama3 / qwen2 / mistral',
  custom: '按模型 API 文档填写',
};

async function loadModels() {
  modelList.value = await listModels();
}

function openCreate() {
  editingId.value = '';
  form.value = {
    name: '',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: '',
    modelName: 'deepseek-v4-flash',
    remark: '',
  };
  drawerOpen.value = true;
}

function openEdit(model: AiApi.ModelConfig) {
  editingId.value = model.id;
  form.value = {
    name: model.name,
    provider: model.provider,
    apiKey: '', // 不回填 apiKey（展示脱敏值，留空表示不修改）
    baseUrl: model.baseUrl ?? '',
    modelName: model.modelName,
    remark: model.remark ?? '',
  };
  drawerOpen.value = true;
}

async function handleSave() {
  if (!form.value.name.trim() || !form.value.modelName.trim()) return;
  saving.value = true;
  try {
    await (editingId.value
      ? updateModel(editingId.value, form.value)
      : createModel(form.value));
    drawerOpen.value = false;
    await loadModels();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(id: string) {
  await deleteModel(id);
  await loadModels();
}

async function handleSetDefault(id: string) {
  await setDefaultModel(id);
  await loadModels();
}

async function handleTest(id: string) {
  testing.value = id;
  try {
    const result = await testModel(id);
    message.success(
      $t('page.ai.config.testOk').replace('{ms}', String(result.latencyMs)),
    );
  } catch {
    message.error($t('page.ai.config.testFail'));
  } finally {
    testing.value = '';
  }
}

onMounted(loadModels);
</script>

<template>
  <div class="p-4">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold">
        {{ $t('page.ai.config.modelList') }}
      </h2>
      <a-button type="primary" @click="openCreate">
        + {{ $t('page.ai.config.addModel') }}
      </a-button>
    </div>

    <a-table :data-source="modelList" row-key="id" :pagination="false">
      <a-table-column title="名称" data-index="name" />
      <a-table-column title="提供商" data-index="provider" :width="100">
        <template #default="{ text }">
          <a-tag>{{ text }}</a-tag>
        </template>
      </a-table-column>
      <a-table-column title="模型" data-index="modelName" />
      <a-table-column title="接口地址" data-index="baseUrl" ellipsis />
      <a-table-column title="API Key" data-index="apiKeyMasked" :width="120" />
      <a-table-column title="状态" :width="80">
        <template #default="{ record }">
          <a-badge
            :status="record.status === 1 ? 'success' : 'default'"
            :text="record.status === 1 ? '启用' : '停用'"
          />
        </template>
      </a-table-column>
      <a-table-column title="默认" :width="70">
        <template #default="{ record }">
          <a-tag v-if="record.isDefault" color="blue">默认</a-tag>
        </template>
      </a-table-column>
      <a-table-column title="操作" :width="220">
        <template #default="{ record }">
          <a-space>
            <a-button size="small" @click="openEdit(record)">编辑</a-button>
            <a-button
              size="small"
              :loading="testing === record.id"
              @click="handleTest(record.id)"
            >
              测试
            </a-button>
            <a-button
              v-if="!record.isDefault"
              size="small"
              @click="handleSetDefault(record.id)"
            >
              设默认
            </a-button>
            <a-popconfirm title="确认删除？" @confirm="handleDelete(record.id)">
              <a-button v-if="!record.isDefault" size="small" danger>
                删除
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table-column>
    </a-table>

    <!-- 新增/编辑抽屉 -->
    <a-drawer
      v-model:open="drawerOpen"
      :title="editingId ? '编辑模型' : $t('page.ai.config.addModel')"
      :width="480"
    >
      <a-form layout="vertical">
        <a-form-item label="显示名称" required>
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item :label="$t('page.ai.config.provider')" required>
          <a-select v-model:value="form.provider" :options="providerOptions" />
        </a-form-item>
        <a-form-item :label="$t('page.ai.config.modelName')" required>
          <a-input
            v-model:value="form.modelName"
            :placeholder="defaultModelHints[form.provider]"
          />
          <div class="mt-1 text-xs text-gray-400">
            {{ defaultModelHints[form.provider] }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('page.ai.config.apiKey')">
          <a-input-password
            v-model:value="form.apiKey"
            :placeholder="editingId ? '留空表示不修改' : ''"
          />
        </a-form-item>
        <a-form-item
          v-if="form.provider === 'ollama' || form.provider === 'custom'"
          :label="$t('page.ai.config.baseUrl')"
        >
          <a-input
            v-model:value="form.baseUrl"
            placeholder="http://localhost:11434"
          />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" />
        </a-form-item>
      </a-form>

      <template #footer>
        <a-space>
          <a-button @click="drawerOpen = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="handleSave">
            保存
          </a-button>
        </a-space>
      </template>
    </a-drawer>
  </div>
</template>
