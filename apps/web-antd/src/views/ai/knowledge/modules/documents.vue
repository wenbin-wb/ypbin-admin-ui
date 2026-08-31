<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { reactive, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Alert,
  Modal as AntModal,
  Badge,
  Button,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Spin,
  Tabs,
  Tooltip,
  Upload,
} from 'ant-design-vue';

import { getDocumentChunks, importDocumentFromUrl } from '#/api/ai';
import { $t } from '#/locales';
import { extractErrorMessage } from '#/utils/error';

import { useDocumentsGrid } from './use-documents-grid';
import { useRecallTest } from './use-recall-test';

const emits = defineEmits<{ reload: [] }>();

const activeTab = ref<'docs' | 'test'>('docs');

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

// 文档列表域（表格/关键词过滤/批量上传/删除/重试/处理中轮询）
const {
  docKeyword,
  docUploading,
  formatSize,
  gridApi,
  Grid,
  isPolling,
  onDeleteDoc,
  onRetryDoc,
  onSelectFile,
  statusTag,
  stopPolling,
} = useDocumentsGrid({
  getKb: () => modalApi.getData(),
  onReload: () => emits('reload'),
});

// 检索测试域（提问/多模式召回/评估汇总/高亮）
const {
  highlightKeywords,
  onTestQuery,
  recallList,
  recallStats,
  scoreColor,
  scoreTextColor,
  testAnswer,
  testLoading,
  testMode,
  testQuery,
} = useRecallTest({ getKb: () => modalApi.getData() });

// ---- URL / Sitemap / RSS 导入弹窗 ----
const importVisible = ref(false);
const importLoading = ref(false);
const importForm = reactive({
  sourceType: 'URL' as 'RSS' | 'SITEMAP' | 'URL',
  url: '',
  maxUrls: 10,
});

function openImport(type: 'RSS' | 'SITEMAP' | 'URL') {
  importForm.sourceType = type;
  importForm.url = '';
  importForm.maxUrls = 10;
  importVisible.value = true;
}

async function onImportSubmit() {
  if (!importForm.url.trim()) {
    message.warning($t('page.ai.knowledge.importUrlPlaceholder'));
    return;
  }
  const kb = modalApi.getData();
  if (!kb) return;
  importLoading.value = true;
  try {
    const docs = await importDocumentFromUrl(kb.id, {
      sourceType: importForm.sourceType,
      url: importForm.url.trim(),
      maxUrls: importForm.maxUrls,
    });
    importVisible.value = false;
    message.success(
      $t('page.ai.knowledge.importSuccess').replace(
        '{count}',
        String(docs.length),
      ),
    );
    gridApi.query();
    emits('reload');
  } catch (error) {
    message.error(
      extractErrorMessage(error, $t('page.ai.knowledge.importFail')),
    );
  } finally {
    importLoading.value = false;
  }
}

// ---- 分块可视化弹窗 ----
const chunkVisible = ref(false);
const chunkLoading = ref(false);
const chunkDocName = ref('');
const chunkList = ref<
  Array<{ charCount: number; chunkIndex: number; content: string }>
>([]);

async function openChunks(row: { filename?: string; id: string }) {
  const kb = modalApi.getData();
  if (!kb) return;
  chunkVisible.value = true;
  chunkLoading.value = true;
  chunkDocName.value = row.filename ?? '';
  chunkList.value = [];
  try {
    chunkList.value = await getDocumentChunks(kb.id, row.id);
  } catch (error) {
    message.error(extractErrorMessage(error, $t('common.requestFailed')));
  } finally {
    chunkLoading.value = false;
  }
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
            :before-upload="onSelectFile"
            accept=".pdf,.md,.txt,.docx,.xlsx,.html,.htm"
            :multiple="true"
            :show-upload-list="false"
          >
            <Button :loading="docUploading" type="primary">
              <Plus class="size-4" />
              {{ $t('page.ai.knowledge.upload') }}
            </Button>
          </Upload>
          <Dropdown>
            <Button>
              {{ $t('page.ai.knowledge.importDoc') }}
              <span class="ml-1 text-xs opacity-60">▾</span>
            </Button>
            <template #overlay>
              <div
                class="min-w-[160px] overflow-hidden rounded-md border border-border bg-background py-1 shadow-md"
              >
                <div
                  v-for="type in ['URL', 'SITEMAP', 'RSS'] as const"
                  :key="type"
                  class="cursor-pointer px-4 py-2 text-sm transition-colors hover:bg-muted"
                  @click="openImport(type)"
                >
                  {{
                    type === 'URL'
                      ? $t('page.ai.knowledge.importUrl')
                      : type === 'SITEMAP'
                        ? $t('page.ai.knowledge.importSitemap')
                        : $t('page.ai.knowledge.importRss')
                  }}
                </div>
              </div>
            </template>
          </Dropdown>
          <span class="text-xs text-muted-foreground">
            {{ $t('page.ai.knowledge.uploadHint') }}
          </span>
          <span class="ml-auto flex items-center gap-2">
            <Input
              v-model:value="docKeyword"
              :placeholder="$t('page.ai.knowledge.docSearchPlaceholder')"
              allow-clear
              class="w-44"
              @change="gridApi.query()"
            />
            <span
              v-if="isPolling"
              class="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <span
                class="inline-block size-1.5 animate-ping rounded-full bg-primary"
              ></span>
              {{ $t('page.ai.knowledge.pollingHint') }}
            </span>
          </span>
        </div>

        <Grid class="min-h-[260px]">
          <template #filename="{ row }">
            <Tooltip :title="row.sourceUrl || row.filename">
              <div class="flex items-center gap-1.5 truncate">
                <span
                  v-if="row.sourceType && row.sourceType !== 'UPLOAD'"
                  class="shrink-0 rounded bg-blue-100 px-1 py-px text-[10px] font-medium leading-4 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  >{{ row.sourceType }}</span>
                <span class="truncate">{{ row.filename }}</span>
              </div>
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
                ...(row.status === 1
                  ? [
                      {
                        text: $t('page.ai.knowledge.chunks'),
                        icon: 'lucide:list-tree',
                        onClick: () => openChunks(row),
                      },
                    ]
                  : []),
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

        <!-- 召回评估汇总 -->
        <div
          v-if="recallStats"
          class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
        >
          <span>
            {{ $t('page.ai.knowledge.recallHint') }}
            <b class="text-foreground">{{ recallList.length }}</b>
          </span>
          <span>
            {{ $t('page.ai.knowledge.recallAvgScore') }}
            <b :class="scoreTextColor(recallStats.avg)">{{
              recallStats.avg
            }}</b>
          </span>
          <span>
            {{ $t('page.ai.knowledge.recallMaxScore') }}
            <b class="text-foreground">{{ recallStats.max }}</b>
          </span>
          <span>
            {{ $t('page.ai.knowledge.recallHitKeywords') }}
            <template v-if="recallStats.tokens.length">
              <b
                v-for="t in recallStats.tokens"
                :key="t"
                class="mr-1 inline-block rounded bg-primary/10 px-1 py-0.5 text-[10px] font-normal text-primary"
                >{{ t }}</b>
            </template>
            <template v-else>0</template>
          </span>
        </div>

        <!-- 召回片段 -->
        <template v-if="recallList.length > 0">
          <div class="flex flex-col gap-2">
            <div
              v-for="(doc, idx) in recallList"
              :key="idx"
              class="rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
            >
              <div
                class="mb-2 flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span
                  class="inline-flex size-4 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary"
                  >#{{ idx + 1 }}</span>
                <span
                  class="max-w-52 truncate font-medium text-foreground/80"
                  >{{ doc.docName || doc.source || 'unknown' }}</span>
                <span class="ml-auto flex shrink-0 items-center gap-2">
                  <span class="text-[10px]">{{ doc.charCount ?? 0 }} chars</span>
                  <span class="flex items-center gap-1.5">
                    <span
                      class="h-1.5 w-12 overflow-hidden rounded-full bg-muted"
                    >
                      <span
                        class="block h-full rounded-full transition-all"
                        :class="scoreColor(doc.score)"
                        :style="{ width: `${Math.min(100, doc.score ?? 0)}%` }"
                      ></span>
                    </span>
                    <span
                      class="w-7 text-right text-xs font-semibold"
                      :class="scoreTextColor(doc.score)"
                      >{{ doc.score ?? 0 }}</span>
                  </span>
                </span>
              </div>
              <!-- eslint-disable vue/no-v-html -->
              <p
                class="m-0 text-[13px] leading-relaxed text-foreground/80"
                v-html="highlightKeywords(doc.content, doc.hitKeywords)"
              ></p>
              <!-- eslint-enable vue/no-v-html -->
              <div
                v-if="doc.hitKeywords?.length"
                class="mt-2 flex flex-wrap gap-1"
              >
                <span
                  v-for="kw in doc.hitKeywords"
                  :key="kw"
                  class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                  >{{ kw }}</span>
              </div>
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

  <!-- URL / Sitemap / RSS 导入弹窗 -->
  <AntModal
    v-model:open="importVisible"
    :confirm-loading="importLoading"
    :ok-text="$t('page.ai.knowledge.importSubmit')"
    :title="
      importForm.sourceType === 'URL'
        ? $t('page.ai.knowledge.importUrl')
        : importForm.sourceType === 'SITEMAP'
          ? $t('page.ai.knowledge.importSitemap')
          : $t('page.ai.knowledge.importRss')
    "
    width="520px"
    @ok="onImportSubmit"
  >
    <Form :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }" class="mt-4">
      <Form.Item
        :label="
          importForm.sourceType === 'URL'
            ? $t('page.ai.knowledge.importUrlLabel')
            : importForm.sourceType === 'SITEMAP'
              ? $t('page.ai.knowledge.importSitemapLabel')
              : $t('page.ai.knowledge.importRssLabel')
        "
        required
      >
        <Input
          v-model:value="importForm.url"
          :placeholder="
            importForm.sourceType === 'URL'
              ? $t('page.ai.knowledge.importUrlPlaceholder')
              : importForm.sourceType === 'SITEMAP'
                ? $t('page.ai.knowledge.importSitemapPlaceholder')
                : $t('page.ai.knowledge.importRssPlaceholder')
          "
          allow-clear
        />
      </Form.Item>
      <Form.Item
        v-if="importForm.sourceType === 'SITEMAP'"
        :label="$t('page.ai.knowledge.importMaxUrls')"
      >
        <InputNumber
          v-model:value="importForm.maxUrls"
          :max="100"
          :min="1"
          class="w-full"
        />
      </Form.Item>
    </Form>
  </AntModal>

  <!-- 分块可视化弹窗 -->
  <AntModal
    v-model:open="chunkVisible"
    :title="`${$t('page.ai.knowledge.chunks')} · ${chunkDocName}`"
    :footer="null"
    width="720px"
  >
    <Spin :spinning="chunkLoading">
      <div v-if="chunkList.length" class="flex flex-col gap-2">
        <div
          v-for="chunk in chunkList"
          :key="chunk.chunkIndex"
          class="rounded-lg border border-border bg-muted/30 p-3"
        >
          <div
            class="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span
              class="inline-flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary"
              >#{{ chunk.chunkIndex + 1 }}</span>
            <span class="ml-auto shrink-0 text-[10px]">
              {{ chunk.charCount ?? 0 }} chars
            </span>
          </div>
          <p
            class="m-0 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/80"
          >
            {{ chunk.content }}
          </p>
        </div>
      </div>
      <Empty
        v-else-if="!chunkLoading"
        :description="$t('page.ai.knowledge.chunksEmpty')"
        class="py-10"
      />
    </Spin>
  </AntModal>
</template>
