<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, onMounted, ref } from 'vue';

import {
  createPromptTemplate,
  deletePromptTemplate,
  listPromptTemplates,
  togglePromptTemplate,
  updatePromptTemplate,
} from '#/api/ai';
import { $t } from '#/locales';

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

const categoryOptions = computed(() => [
  { value: 'coding', label: $t('page.ai.prompt.categoryCoding') },
  { value: 'writing', label: $t('page.ai.prompt.categoryWriting') },
  { value: 'analysis', label: $t('page.ai.prompt.categoryAnalysis') },
  { value: 'translation', label: $t('page.ai.prompt.categoryTranslation') },
  { value: 'qa', label: $t('page.ai.prompt.categoryQa') },
  { value: 'other', label: $t('page.ai.prompt.categoryOther') },
]);

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
  return (
    categoryOptions.value.find((o) => o.value === val)?.label ?? val ?? '-'
  );
}

onMounted(loadList);
</script>

<template>
  <div class="p-4">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold">
        {{ $t('page.ai.prompt.title') }}
      </h2>
      <a-button type="primary" @click="openCreate">
        + {{ $t('page.ai.prompt.create') }}
      </a-button>
    </div>

    <a-table :data-source="templateList" row-key="id" :pagination="false">
      <a-table-column :title="$t('page.ai.prompt.name')" data-index="name" />
      <a-table-column :title="$t('page.ai.prompt.category')" :width="100">
        <template #default="{ record }">
          {{ categoryLabel(record.category) }}
        </template>
      </a-table-column>
      <a-table-column
        :title="$t('page.ai.prompt.description')"
        data-index="description"
        ellipsis
      />
      <a-table-column :title="$t('page.ai.prompt.status')" :width="80">
        <template #default="{ record }">
          <a-badge
            :status="record.status === 1 ? 'success' : 'default'"
            :text="
              record.status === 1
                ? $t('page.ai.prompt.enabled')
                : $t('page.ai.prompt.disabled')
            "
          />
        </template>
      </a-table-column>
      <a-table-column
        :title="$t('common.createTime')"
        data-index="createTime"
        :width="170"
      />
      <a-table-column :title="$t('page.ai.prompt.action')" :width="200">
        <template #default="{ record }">
          <a-space>
            <a-button size="small" @click="openEdit(record)">
              {{ $t('common.edit') }}
            </a-button>
            <a-button
              size="small"
              @click="handleToggle(record.id, record.status)"
            >
              {{
                record.status === 1
                  ? $t('page.ai.prompt.disabled')
                  : $t('page.ai.prompt.enabled')
              }}
            </a-button>
            <a-popconfirm
              :title="$t('page.ai.prompt.confirmDelete')"
              @confirm="handleDelete(record.id)"
            >
              <a-button size="small" danger>
                {{ $t('page.ai.prompt.delete') }}
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table-column>
    </a-table>

    <a-drawer
      v-model:open="drawerOpen"
      :title="
        editingId ? $t('page.ai.prompt.edit') : $t('page.ai.prompt.create')
      "
      width="560"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('page.ai.prompt.name')" required>
          <a-input v-model:value="form.name" />
        </a-form-item>
        <a-form-item :label="$t('page.ai.prompt.category')">
          <a-select
            v-model:value="form.category"
            :options="categoryOptions"
            allow-clear
            :placeholder="$t('page.ai.prompt.selectCategory')"
          />
        </a-form-item>
        <a-form-item :label="$t('page.ai.prompt.template')" required>
          <a-textarea
            v-model:value="form.template"
            :rows="8"
            :placeholder="$t('page.ai.prompt.placeholderTip')"
          />
          <div class="mt-1 text-xs text-gray-400">
            {{ $t('page.ai.prompt.placeholderDetail') }}
          </div>
        </a-form-item>
        <a-form-item :label="$t('page.ai.prompt.description')">
          <a-input v-model:value="form.description" />
        </a-form-item>
      </a-form>

      <template #footer>
        <a-space>
          <a-button @click="drawerOpen = false">
            {{ $t('page.ai.prompt.cancel') }}
          </a-button>
          <a-button type="primary" :loading="saving" @click="handleSave">
            {{ $t('page.ai.prompt.save') }}
          </a-button>
        </a-space>
      </template>
    </a-drawer>
  </div>
</template>
