<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { onMounted, ref } from 'vue';

import {
  createKnowledgeBase,
  deleteDocument,
  deleteKnowledgeBase,
  listDocuments,
  listKnowledgeBases,
  queryKnowledgeBase,
} from '#/api/ai';
import { requestClient } from '#/api/request';
import { $t } from '#/locales';

defineOptions({ name: 'AiKnowledge' });

const kbList = ref<AiApi.KnowledgeBase[]>([]);
const activeKb = ref<AiApi.KnowledgeBase | null>(null);
const docList = ref<AiApi.KbDocument[]>([]);
const drawerOpen = ref(false);
const createModalOpen = ref(false);
const createForm = ref<AiApi.KnowledgeBaseSaveReq>({
  name: '',
  description: '',
});
const testQuery = ref('');
const testAnswer = ref('');
const testLoading = ref(false);
const uploading = ref(false);

async function loadKbList() {
  kbList.value = await listKnowledgeBases();
}

async function openKb(kb: AiApi.KnowledgeBase) {
  activeKb.value = kb;
  const data = await listDocuments(kb.id, { page: 1, pageSize: 100 });
  docList.value = data.items ?? [];
  drawerOpen.value = true;
}

async function handleCreateKb() {
  if (!createForm.value.name.trim()) return;
  await createKnowledgeBase(createForm.value);
  createModalOpen.value = false;
  createForm.value = { name: '', description: '' };
  await loadKbList();
}

async function handleDeleteKb(id: string) {
  await deleteKnowledgeBase(id);
  if (activeKb.value?.id === id) drawerOpen.value = false;
  await loadKbList();
}

async function handleDeleteDoc(docId: string) {
  if (!activeKb.value) return;
  await deleteDocument(activeKb.value.id, docId);
  docList.value = docList.value.filter((d) => d.id !== docId);
}

async function handleUpload(file: File) {
  if (!activeKb.value) return false;
  uploading.value = true;
  const formData = new FormData();
  formData.append('file', file);
  try {
    await requestClient.post(
      `/ai/knowledge-bases/${activeKb.value.id}/documents`,
      formData,
    );
    const data = await listDocuments(activeKb.value.id, {
      page: 1,
      pageSize: 100,
    });
    docList.value = data.items ?? [];
  } finally {
    uploading.value = false;
  }
  return false; // 阻止 ant-design Upload 默认行为
}

async function handleTestQuery() {
  if (!activeKb.value || !testQuery.value.trim()) return;
  testLoading.value = true;
  testAnswer.value = '';
  try {
    testAnswer.value = await queryKnowledgeBase(
      activeKb.value.id,
      testQuery.value,
    );
  } finally {
    testLoading.value = false;
  }
}

function statusTag(status: number) {
  switch (status) {
    case 0: {
      return { color: 'processing', text: $t('page.ai.knowledge.processing') };
    }
    case 1: {
      return { color: 'success', text: $t('page.ai.knowledge.ready') };
    }
    default: {
      return { color: 'error', text: $t('page.ai.knowledge.failed') };
    }
  }
}

function formatSize(bytes: number) {
  if (!bytes) return '-';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${units[i]}`;
}

onMounted(loadKbList);
</script>

<template>
  <div class="p-4">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold">
        {{ $t('page.ai.knowledge.title') }}
      </h2>
      <a-button type="primary" @click="createModalOpen = true">
        + {{ $t('page.ai.knowledge.create') }}
      </a-button>
    </div>

    <!-- 知识库卡片 -->
    <a-row :gutter="[16, 16]">
      <a-col
        v-for="kb in kbList"
        :key="kb.id"
        :xs="24"
        :sm="12"
        :md="8"
        :lg="6"
      >
        <a-card hoverable class="cursor-pointer" @click="openKb(kb)">
          <a-card-meta
            :title="kb.name"
            :description="
              kb.description || $t('page.ai.knowledge.noDescription')
            "
          />
          <div
            class="mt-3 flex items-center justify-between text-sm text-gray-500"
          >
            <span>
              {{ kb.docCount }} {{ $t('page.ai.knowledge.docCountSuffix') }}
            </span>
            <a-popconfirm
              :title="$t('page.ai.knowledge.confirmDeleteKb')"
              @confirm.stop="handleDeleteKb(kb.id)"
              @click.stop
            >
              <a-button size="small" danger type="link">
                {{ $t('page.ai.knowledge.delete') }}
              </a-button>
            </a-popconfirm>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 新建知识库弹窗 -->
    <a-modal
      v-model:open="createModalOpen"
      :title="$t('page.ai.knowledge.create')"
      @ok="handleCreateKb"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('page.ai.knowledge.name')" required>
          <a-input v-model:value="createForm.name" />
        </a-form-item>
        <a-form-item :label="$t('page.ai.knowledge.description')">
          <a-textarea v-model:value="createForm.description" :rows="3" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 文档抽屉 -->
    <a-drawer
      v-model:open="drawerOpen"
      :title="activeKb?.name"
      width="640"
      :footer-style="{ textAlign: 'right' }"
    >
      <!-- 上传区 -->
      <div class="mb-4">
        <a-upload
          :before-upload="handleUpload"
          accept=".pdf,.md,.txt"
          :show-upload-list="false"
        >
          <a-button :loading="uploading" type="primary">
            {{ $t('page.ai.knowledge.upload') }}
          </a-button>
        </a-upload>
        <div class="mt-1 text-xs text-gray-400">
          {{ $t('page.ai.knowledge.uploadHint') }}
        </div>
      </div>

      <!-- 文档列表 -->
      <a-table
        :data-source="docList"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <a-table-column
          :title="$t('page.ai.knowledge.filename')"
          data-index="filename"
          ellipsis
        />
        <a-table-column :title="$t('page.ai.knowledge.size')" :width="80">
          <template #default="{ record }">
            {{ formatSize(record.fileSize) }}
          </template>
        </a-table-column>
        <a-table-column
          :title="$t('page.ai.knowledge.chunkCount')"
          :width="70"
          data-index="chunkCount"
        />
        <a-table-column :title="$t('page.ai.knowledge.status')" :width="90">
          <template #default="{ record }">
            <a-badge
              :status="statusTag(record.status).color"
              :text="statusTag(record.status).text"
            />
          </template>
        </a-table-column>
        <a-table-column :title="$t('page.ai.knowledge.action')" :width="80">
          <template #default="{ record }">
            <a-popconfirm
              :title="$t('page.ai.knowledge.confirmDelete')"
              @confirm="handleDeleteDoc(record.id)"
            >
              <a-button size="small" danger type="link">
                {{ $t('page.ai.knowledge.delete') }}
              </a-button>
            </a-popconfirm>
          </template>
        </a-table-column>
      </a-table>

      <!-- 测试问答 -->
      <div class="mt-6">
        <div class="mb-2 font-medium">
          {{ $t('page.ai.knowledge.testQuery') }}
        </div>
        <a-input-search
          v-model:value="testQuery"
          :placeholder="$t('page.ai.knowledge.testQueryPlaceholder')"
          :loading="testLoading"
          :enter-button="$t('page.ai.knowledge.ask')"
          @search="handleTestQuery"
        />
        <a-alert
          v-if="testAnswer"
          :message="testAnswer"
          type="info"
          class="mt-2"
          show-icon
        />
      </div>
    </a-drawer>
  </div>
</template>
