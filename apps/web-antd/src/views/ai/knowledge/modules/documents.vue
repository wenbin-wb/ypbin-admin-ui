<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { onUnmounted, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Alert,
  Badge,
  Button,
  Empty,
  message,
  Tabs,
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
const activeTab = ref<'docs' | 'test'>('docs');
const testQuery = ref('');
const testAnswer = ref('');
const testLoading = ref(false);
const recallList = ref<
  Array<{ content: string; metadata: Record<string, any>; source?: string }>
>([]);
const testMode = ref<'multiple' | 'rerank' | 'single'>('single');

// 轮询：有"处理中"文档时每 3 秒刷新一次
let pollTimer: null | ReturnType<typeof setInterval> = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    gridApi.query({ silent: true } as any);
  }, 3000);
}
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
onUnmounted(stopPolling);

const [Modal, modalApi] = useVbenModal<AiApi.KnowledgeBase | null>({
  onOpenChange: (isOpen) => {
    if (isOpen) {
      activeTab.value = 'docs';
      testQuery.value = '';
      testAnswer.value = '';
      recallList.value = [];
      gridApi.query();
    } else {
      stopPolling();
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
        slots: { default: 'filename' },
      },
      {
        field: 'fileSize',
        title: $t('page.ai.knowledge.size'),
        minWidth: 90,
        slots: { default: 'size' },
      },
      {
        field: 'chunkCount',
        title: $t('page.ai.knowledge.chunkCount'),
        minWidth: 80,
        formatter: ({ cellValue }) => (cellValue > 0 ? String(cellValue) : '-'),
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
        minWidth: 160,
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
          // 有处理中的文档则轮询，全部就绪/失败则停止
          const hasProcessing = res.items.some((d) => d.status === 0);
          if (hasProcessing) startPolling();
          else stopPolling();
          return { items: res.items, total: res.total };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, export: false, refresh: true, zoom: true },
  } as VxeTableGridOptions<AiApi.KbDocument>,
});

async function onUpload(file: File) {
  docUploading.value = true;
  const kb = modalApi.getData();
  if (!kb) return false;
  try {
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
  } catch (error: any) {
    message.error(error?.message || $t('common.requestFailed'));
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
  return `${(bytes / k ** i).toFixed(1)} ${units[i] ?? 'B'}`;
}

defineExpose({ modalApi });
</script>

<template>
  <Modal
    :title="modalApi.getData()?.name ?? ''"
    class="w-[1100px] max-w-[calc(100vw-40px)]"
  >
    <Tabs v-model:active-key="activeTab" :animated="false">
      <!-- ===== Tab 1: 文档管理 ===== -->
      <Tabs.TabPane key="docs" :tab="$t('page.ai.knowledge.tabDocs')">
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
          <span class="text-xs text-muted-foreground">
            {{ $t('page.ai.knowledge.uploadHint') }}
          </span>
          <span
            v-if="pollTimer !== null"
            class="ml-auto flex items-center gap-1 text-xs text-muted-foreground"
          >
            <span
              class="inline-block size-1.5 animate-ping rounded-full bg-primary"
            ></span>
            {{ $t('page.ai.knowledge.pollingHint') }}
          </span>
        </div>

        <Grid class="min-h-[260px]">
          <template #filename="{ row }">
            <Tooltip :title="row.filename">
              <span class="truncate">{{ row.filename }}</span>
            </Tooltip>
          </template>
          <template #size="{ row }">
            {{ formatSize(row.fileSize) }}
          </template>
          <template #status="{ row }">
            <Tooltip
              :title="
                row.status === 2 && row.errorMsg ? row.errorMsg : undefined
              "
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
                  text: $t('common.delete'),
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
      </Tabs.TabPane>

      <!-- ===== Tab 2: 检索测试 ===== -->
      <Tabs.TabPane key="test" :tab="$t('page.ai.knowledge.tabTest')">
        <!-- 检索模式切换 -->
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <Button
            v-for="mode in ['single', 'rerank', 'multiple'] as const"
            :key="mode"
            :type="testMode === mode ? 'primary' : 'default'"
            size="small"
            @click="testMode = mode"
          >
            {{
              mode === 'single'
                ? $t('page.ai.knowledge.testModeSingle')
                : mode === 'rerank'
                  ? $t('page.ai.knowledge.testModeRerank')
                  : $t('page.ai.knowledge.testModeMultiple')
            }}
          </Button>
        </div>

        <!-- 输入框 -->
        <div class="mb-4 flex gap-2">
          <input
            v-model="testQuery"
            type="text"
            :placeholder="$t('page.ai.knowledge.testQueryPlaceholder')"
            class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            @keydown.enter="onTestQuery"
          />
          <Button :loading="testLoading" type="primary" @click="onTestQuery">
            {{ $t('page.ai.knowledge.ask') }}
          </Button>
        </div>

        <!-- AI 回答 -->
        <div v-if="testAnswer" class="mb-4">
          <p class="mb-1.5 text-xs font-medium text-muted-foreground">
            {{ $t('page.ai.knowledge.answerLabel') }}
          </p>
          <Alert
            :message="testAnswer"
            class="whitespace-pre-wrap text-[13px]"
            show-icon
            type="info"
          />
        </div>

        <!-- 召回片段 -->
        <template v-if="recallList.length > 0">
          <p class="mb-2 text-xs font-medium text-muted-foreground">
            {{ $t('page.ai.knowledge.recallHint') }}（{{ recallList.length }}）
          </p>
          <div class="flex flex-col gap-2">
            <div
              v-for="(doc, idx) in recallList"
              :key="idx"
              class="rounded-lg border border-border bg-muted/30 p-3"
            >
              <div
                class="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span
                  class="inline-flex size-4 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary"
                  >#{{ idx + 1 }}</span>
                <span class="truncate">{{ doc.source }}</span>
              </div>
              <p class="m-0 text-[13px] leading-relaxed text-foreground/80">
                {{ doc.content }}
              </p>
            </div>
          </div>
        </template>

        <!-- 空态 -->
        <Empty
          v-else-if="!testLoading && !testAnswer"
          :description="$t('page.ai.knowledge.testQueryPlaceholder')"
          class="py-12"
        />
      </Tabs.TabPane>
    </Tabs>
  </Modal>
</template>
