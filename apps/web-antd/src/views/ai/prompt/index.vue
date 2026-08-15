<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { onMounted, ref } from 'vue';

import {
  createPromptTemplate,
  deletePromptTemplate,
  listPromptTemplates,
  togglePromptTemplate,
  updatePromptTemplate,
} from '#/api/ai';

defineOptions({ name: 'AiPrompt' });

const templateList = ref<AiApi.PromptTemplate[]>([]);
const drawerOpen = ref(false);
const editingId = ref('');
const saving = ref(false);
const form = ref<AiApi.PromptTemplateSaveReq>({
  name: '',
  category: '',
  template: '',
  description: '',
});

const categoryOptions = [
  { value: 'coding', label: '代码开发' },
  { value: 'writing', label: '内容写作' },
  { value: 'analysis', label: '数据分析' },
  { value: 'translation', label: '翻译' },
  { value: 'qa', label: '问答助手' },
  { value: 'other', label: '其他' },
];

async function loadList() {
  templateList.value = await listPromptTemplates();
}

function openCreate() {
  editingId.value = '';
  form.value = { name: '', category: '', template: '', description: '' };
  drawerOpen.value = true;
}

function openEdit(tpl: AiApi.PromptTemplate) {
  editingId.value = tpl.id;
  form.value = {
    name: tpl.name,
    category: tpl.category ?? '',
    template: tpl.template,
    description: tpl.description ?? '',
  };
  drawerOpen.value = true;
}

async function handleSave() {
  if (!form.value.name.trim() || !form.value.template.trim()) return;
  saving.value = true;
  try {
    await (editingId.value
      ? updatePromptTemplate(editingId.value, form.value)
      : createPromptTemplate(form.value));
    drawerOpen.value = false;
    await loadList();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(id: string) {
  await deletePromptTemplate(id);
  await loadList();
}

async function handleToggle(id: string, currentStatus: number) {
  await togglePromptTemplate(id, currentStatus === 1 ? 0 : 1);
  await loadList();
}

function categoryLabel(val?: string) {
  return categoryOptions.find((o) => o.value === val)?.label ?? val ?? '-';
}

onMounted(loadList);
</script>

<template>
  <div class="p-4">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold">Prompt 模板</h2>
      <a-button type="primary" @click="openCreate">+ 新增模板</a-button>
    </div>

    <a-table :data-source="templateList" row-key="id" :pagination="false">
      <a-table-column title="名称" data-index="name" />
      <a-table-column title="分类" :width="100">
        <template #default="{ record }">
{{
          categoryLabel(record.category)
        }}
</template>
      </a-table-column>
      <a-table-column title="描述" data-index="description" ellipsis />
      <a-table-column title="状态" :width="80">
        <template #default="{ record }">
          <a-badge
            :status="record.status === 1 ? 'success' : 'default'"
            :text="record.status === 1 ? '启用' : '停用'"
          />
        </template>
      </a-table-column>
      <a-table-column title="创建时间" data-index="createTime" :width="170" />
      <a-table-column title="操作" :width="200">
        <template #default="{ record }">
          <a-space>
            <a-button size="small" @click="openEdit(record)">编辑</a-button>
            <a-button
              size="small"
              @click="handleToggle(record.id, record.status)"
            >
              {{ record.status === 1 ? '停用' : '启用' }}
            </a-button>
            <a-popconfirm title="确认删除？" @confirm="handleDelete(record.id)">
              <a-button size="small" danger>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table-column>
    </a-table>

    <a-drawer
      v-model:open="drawerOpen"
      :title="editingId ? '编辑模板' : '新增模板'"
      width="560"
    >
      <a-form layout="vertical">
        <a-form-item label="模板名称" required>
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item label="分类">
          <a-select
            v-model:value="form.category"
            :options="categoryOptions"
            allow-clear
            placeholder="请选择分类"
          />
        </a-form-item>
        <a-form-item label="系统提示词" required>
          <a-textarea
            v-model:value="form.template"
            :rows="8"
            placeholder="输入系统提示词，支持占位符如 {username}、{date}"
          />
          <div class="mt-1 text-xs text-gray-400">
            支持占位符：{username} 用户名、{tenantName} 租户名
          </div>
        </a-form-item>
        <a-form-item label="描述">
          <a-input v-model:value="form.description" />
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
