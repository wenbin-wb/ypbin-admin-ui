<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  message,
  Tooltip,
  Upload,
} from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteDocument,
  getDocumentList,
  queryKnowledgeBase,
  retryDocument,
  searchKnowledgeBaseMultiple,
  searchKnowledgeBaseRerank,
  searchKnowledgeBaseTest,
} from '#/api/ai';
import { requestClient } from '#/api/request';
import { $t } from '#/locales';

const emits = defineEmits<{ reload: [] }>();

const docUploading = ref(false);
const testQuery = ref('');
const testAnswer = ref('');
const testLoading = ref(false);
const recallList = ref<
  Array<{ content: string; metadata: Record<string, any>; source?: string }>
>([]);
const testMode = ref<'multiple' | 'rerank' | 'single'>('single');

const [Modal, modalApi] = useVbenModal<AiApi.KnowledgeBase | null>({
  onOpenChange: (isOpen) => {
    if (isOpen) {
      testQuery.value = '';
      testAnswer.value = '';
      gridApi.query();
    }
  },
});

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
        minWidth: 100,
        slots: { default: 'size' },
      },
      {
        field: 'chunkCount',
        title: $t('page.ai.knowledge.chunkCount'),
        minWidth: 90,
      },
      {
        field: 'status',
        title: $t('page.ai.knowledge.status'),
        minWidth: 100,
        slots: { default: 'status' },
      },
      {
        field: 'createTime',
        title: $t('common.createTime'),
        minWidth: 170,
      },
      {
        align: 'center',
        field: 'operation',
        fixed: 'right',
        slots: { default: 'action' },
        title: $t('common.action'),
        minWidth: 90,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          const kb = modalApi.getData();
          if (!kb) return { items: [], total: 0 };
          const res = await getDocumentList(kb.id, {
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

async function onUpload(file: File) {
  docUploading.value = true;
  const kb = modalApi.getData();
  if (!kb) return false;
  try {
    // requestClient.upload 会自动构造 mulipart/form-data 并正确设置 Content-Type
    await requestClient.upload(`/ai/knowledge-bases/${kb.id}/documents`, {
      file,
    });
    message.success($t('common.success'));
    gridApi.query();
    emits('reload');
  } finally {
    docUploading.value = false;
  }
  return false;
}

function onDeleteDoc(row: AiApi.KbDocument) {
  const kb = modalApi.getData();
  if (!kb) return;
  deleteDocument(kb.id, row.id).then(() => {
    message.success($t('common.success'));
    gridApi.query();
    emits('reload');
  });
}

function onRetryDoc(row: AiApi.KbDocument) {
  const kb = modalApi.getData();
  if (!kb) return;
  retryDocument(kb.id, row.id)
    .then(() => {
      message.success($t('common.success'));
      gridApi.query();
    })
    .catch((error: any) => {
      const reason = error?.message || error?.data?.message;
      message.error(reason || $t('page.ai.knowledge.retryFail'));
    });
}

async function onTestQuery() {
  if (!testQuery.value.trim()) return;
  const kb = modalApi.getData();
  if (!kb) return;
  testLoading.value = true;
  testAnswer.value = '';
  recallList.value = [];
  try {
    const question = testQuery.value;
    [testAnswer.value, recallList.value] = await Promise.all([
      queryKnowledgeBase(kb.id, question),
      fetchRecallByMode(kb.id, question),
    ]);
  } finally {
    testLoading.value = false;
  }
}

async function fetchRecallByMode(
  kbId: string,
  question: string,
): Promise<
  Array<{ content: string; metadata: Record<string, any>; source?: string }>
> {
  switch (testMode.value) {
    case 'multiple': {
      // 多库联合：以当前库为主，附带最近创建的其它库（演示 RRF 合并）
      return searchKnowledgeBaseMultiple([kbId], question, 5).catch(() => []);
    }
    case 'rerank': {
      return searchKnowledgeBaseRerank(kbId, question, 5).catch(() => []);
    }
    default: {
      return searchKnowledgeBaseTest(kbId, question, 5).catch(() => []);
    }
  }
}

function statusTag(status: number) {
  switch (status) {
    case 0: {
      return {
        color: 'processing' as const,
        text: $t('page.ai.knowledge.processing'),
      };
    }
    case 1: {
      return { color: 'success' as const, text: $t('page.ai.knowledge.ready') };
    }
    default: {
      return { color: 'error' as const, text: $t('page.ai.knowledge.failed') };
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

defineExpose({ modalApi });
</script>

<template>
  <Modal
    :title="modalApi.getData()?.name ?? ''"
    :width="1200"
    class="ai-doc-modal"
  >
    <div class="mb-4 flex items-center gap-3">
      <Upload
        :before-upload="onUpload"
        accept=".pdf,.md,.txt"
        :show-upload-list="false"
      >
        <Button :loading="docUploading" type="primary">
          <Plus class="size-4" />
          {{ $t('page.ai.knowledge.upload') }}
        </Button>
      </Upload>
      <span class="text-xs text-gray-400">
        {{ $t('page.ai.knowledge.uploadHint') }}
      </span>
    </div>

    <Grid :table-title="$t('page.ai.knowledge.docCount')" class="mb-4">
      <template #size="{ row }">
        {{ formatSize(row.fileSize) }}
      </template>

      <template #status="{ row }">
        <Tooltip
          :title="row.status === 2 && row.errorMsg ? row.errorMsg : undefined"
        >
          <Badge
            :status="statusTag(row.status).color"
            :text="statusTag(row.status).text"
          />
        </Tooltip>
      </template>

      <template #action="{ row }">
        <VbenTableAction
          :actions="[
            ...(row.status === 2
              ? [
                  {
                    text: $t('page.ai.knowledge.retry'),
                    icon: 'lucide:rotate-ccw',
                    auth: 'ai:document:upload',
                    onClick: () => onRetryDoc(row),
                  },
                ]
              : []),
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

    <Card :title="$t('page.ai.knowledge.testQuery')" size="small">
      <div class="mb-3 flex flex-wrap gap-2">
        <Button
          :type="testMode === 'single' ? 'primary' : 'default'"
          size="small"
          @click="testMode = 'single'"
        >
          {{ $t('page.ai.knowledge.testModeSingle') }}
        </Button>
        <Button
          :type="testMode === 'rerank' ? 'primary' : 'default'"
          size="small"
          @click="testMode = 'rerank'"
        >
          {{ $t('page.ai.knowledge.testModeRerank') }}
        </Button>
        <Button
          :type="testMode === 'multiple' ? 'primary' : 'default'"
          size="small"
          @click="testMode = 'multiple'"
        >
          {{ $t('page.ai.knowledge.testModeMultiple') }}
        </Button>
      </div>
      <Input.Search
        v-model:value="testQuery"
        :enter-button="$t('page.ai.knowledge.ask')"
        :loading="testLoading"
        :placeholder="$t('page.ai.knowledge.testQueryPlaceholder')"
        class="mb-3"
        @search="onTestQuery"
      />
      <Alert
        v-if="testAnswer"
        :message="testAnswer"
        class="whitespace-pre-wrap"
        show-icon
        type="info"
      />

      <template v-if="recallList.length > 0">
        <div class="mt-4 flex items-center gap-2 text-sm font-medium">
          {{ $t('page.ai.knowledge.recallHint') }}（{{ recallList.length }}）
        </div>
        <div class="mt-2 flex flex-col gap-2">
          <div
            v-for="(doc, idx) in recallList"
            :key="idx"
            class="rounded-md border border-border p-3"
          >
            <div
              class="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground"
            >
              <span>#{{ idx + 1 }}</span>
              <span class="truncate">{{ doc.source }}</span>
            </div>
            <p class="m-0 text-[13px] leading-relaxed opacity-90">
              {{ doc.content }}
            </p>
          </div>
        </div>
      </template>
    </Card>
  </Modal>
</template>
