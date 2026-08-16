<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { onMounted, ref } from 'vue';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
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

// ===== 知识库列表 =====
const kbList = ref<AiApi.KnowledgeBase[]>([]);
const loading = ref(false);

async function loadKbList() {
  loading.value = true;
  try {
    kbList.value = await listKnowledgeBases();
  } finally {
    loading.value = false;
  }
}

// ===== 新建知识库弹窗 =====
function useKbFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('page.ai.knowledge.name'),
      rules: 'required',
    },
    {
      component: 'Textarea',
      componentProps: { rows: 3 },
      fieldName: 'description',
      label: $t('page.ai.knowledge.description'),
    },
    {
      component: 'Input',
      fieldName: 'remark',
      label: $t('common.remark'),
    },
  ];
}

const [KbForm, kbFormApi] = useVbenForm({
  layout: 'vertical',
  schema: useKbFormSchema(),
  showDefaultActions: false,
});

const [CreateModal, createModalApi] = useVbenModal({
  onConfirm: async () => {
    const { valid } = await kbFormApi.validate();
    if (!valid) return;
    const values = await kbFormApi.getValues<AiApi.KnowledgeBaseSaveReq>();
    createModalApi.lock();
    createKnowledgeBase(values)
      .then(() => {
        message.success($t('common.success'));
        createModalApi.close();
        loadKbList();
      })
      .catch(() => createModalApi.unlock());
  },
  onOpenChange: (isOpen) => {
    if (isOpen) {
      kbFormApi.resetForm();
    }
  },
});

// ===== 文档管理抽屉 =====
const activeKb = ref<AiApi.KnowledgeBase | null>(null);
const docUploading = ref(false);
const testQuery = ref('');
const testAnswer = ref('');
const testLoading = ref(false);

const [DocDrawer, docDrawerApi] = useVbenDrawer<AiApi.KnowledgeBase | null>({
  onOpenChange: (isOpen) => {
    if (isOpen) {
      const data = docDrawerApi.getData();
      if (data) {
        activeKb.value = data;
        testQuery.value = '';
        testAnswer.value = '';
        gridApi.query();
      }
    }
  },
});

// 文档表格（远程分页）
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: [
      {
        field: 'filename',
        title: $t('page.ai.knowledge.filename'),
        minWidth: 220,
        showOverflow: true,
      },
      {
        field: 'fileSize',
        title: $t('page.ai.knowledge.size'),
        width: 100,
        slots: { default: 'size' },
      },
      {
        field: 'chunkCount',
        title: $t('page.ai.knowledge.chunkCount'),
        width: 90,
      },
      {
        field: 'status',
        title: $t('page.ai.knowledge.status'),
        width: 100,
        slots: { default: 'status' },
      },
      {
        field: 'createTime',
        title: $t('common.createTime'),
        width: 170,
      },
      {
        field: 'action',
        title: $t('common.action'),
        width: 90,
        slots: { default: 'action' },
        fixed: 'right',
      },
    ],
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          if (!activeKb.value) return { items: [], total: 0 };
          const res = await listDocuments(activeKb.value.id, {
            page: page.currentPage,
            pageSize: page.pageSize,
          });
          return { items: res.items, total: res.total };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      zoom: true,
    },
  } as VxeTableGridOptions<AiApi.KbDocument>,
});

// ===== 操作 =====
function onOpenKb(kb: AiApi.KnowledgeBase) {
  docDrawerApi.setData(kb).open();
}

function onDeleteKb(kb: AiApi.KnowledgeBase) {
  deleteKnowledgeBase(kb.id)
    .then(() => {
      message.success($t('common.success'));
      loadKbList();
    })
    .catch(() => {});
}

function onDeleteDoc(row: AiApi.KbDocument) {
  if (!activeKb.value) return;
  deleteDocument(activeKb.value.id, row.id)
    .then(() => {
      message.success($t('common.success'));
      gridApi.query();
    })
    .catch(() => {});
}

async function onUpload(file: File) {
  if (!activeKb.value) return false;
  docUploading.value = true;
  const formData = new FormData();
  formData.append('file', file);
  try {
    await requestClient.post(
      `/ai/knowledge-bases/${activeKb.value.id}/documents`,
      formData,
    );
    message.success($t('common.success'));
    gridApi.query();
  } finally {
    docUploading.value = false;
  }
  return false;
}

async function onTestQuery() {
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
  <Page auto-content-height>
    <div class="p-4">
      <!-- 顶部 -->
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold">
          {{ $t('page.ai.knowledge.title') }}
        </h2>
        <a-button
          v-access:code="['ai:knowledge:create']"
          type="primary"
          @click="createModalApi.open()"
        >
          <Plus class="size-4" />
          {{ $t('page.ai.knowledge.create') }}
        </a-button>
      </div>

      <!-- 知识库卡片 -->
      <a-spin :spinning="loading">
        <a-empty
          v-if="!loading && kbList.length === 0"
          :description="$t('common.noData')"
        />
        <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <a-card
            v-for="kb in kbList"
            :key="kb.id"
            hoverable
            class="cursor-pointer"
            @click="onOpenKb(kb)"
          >
            <a-card-meta
              :description="
                kb.description || $t('page.ai.knowledge.noDescription')
              "
              :title="kb.name"
            />
            <div
              class="mt-3 flex items-center justify-between text-sm text-gray-500"
            >
              <span>
                {{ kb.docCount }} {{ $t('page.ai.knowledge.docCountSuffix') }}
              </span>
              <a-popconfirm
                :title="$t('page.ai.knowledge.confirmDeleteKb')"
                @click.stop
                @confirm.stop="onDeleteKb(kb)"
              >
                <a-button danger size="small" type="link">
                  {{ $t('page.ai.knowledge.delete') }}
                </a-button>
              </a-popconfirm>
            </div>
          </a-card>
        </div>
      </a-spin>
    </div>

    <!-- 新建知识库 -->
    <CreateModal
      :title="$t('page.ai.knowledge.create')"
      :width="480"
    >
      <KbForm />
    </CreateModal>

    <!-- 文档管理抽屉 -->
    <DocDrawer :title="activeKb?.name ?? ''" :width="760">
      <!-- 上传 + 测试问答 -->
      <div class="mb-4 flex items-center gap-3">
        <a-upload
          :before-upload="onUpload"
          accept=".pdf,.md,.txt"
          :show-upload-list="false"
        >
          <a-button :loading="docUploading" type="primary">
            <Plus class="size-4" />
            {{ $t('page.ai.knowledge.upload') }}
          </a-button>
        </a-upload>
        <span class="text-xs text-gray-400">
          {{ $t('page.ai.knowledge.uploadHint') }}
        </span>
      </div>

      <Grid :table-title="$t('page.ai.knowledge.docCount')" class="mb-4">
        <template #size="{ row }">
          {{ formatSize(row.fileSize) }}
        </template>
        <template #status="{ row }">
          <a-badge
            :status="statusTag(row.status).color"
            :text="statusTag(row.status).text"
          />
        </template>
        <template #action="{ row }">
          <VbenTableAction
            :actions="[
              {
                text: $t('page.ai.knowledge.delete'),
                icon: 'lucide:trash-2',
                danger: true,
                popConfirm: {
                  title: $t('page.ai.knowledge.confirmDelete'),
                  confirm: () => onDeleteDoc(row),
                },
              },
            ]"
          />
        </template>
      </Grid>

      <!-- 测试问答 -->
      <a-card :title="$t('page.ai.knowledge.testQuery')" size="small">
        <a-input-search
          v-model:value="testQuery"
          :enter-button="$t('page.ai.knowledge.ask')"
          :loading="testLoading"
          :placeholder="$t('page.ai.knowledge.testQueryPlaceholder')"
          class="mb-3"
          @search="onTestQuery"
        />
        <a-alert
          v-if="testAnswer"
          :message="testAnswer"
          class="whitespace-pre-wrap"
          show-icon
          type="info"
        />
      </a-card>
    </DocDrawer>
  </Page>
</template>
