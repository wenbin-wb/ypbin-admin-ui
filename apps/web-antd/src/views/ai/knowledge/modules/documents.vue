<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AiApi } from '#/api/ai';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, Card, message, Upload } from 'ant-design-vue';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  deleteDocument,
  listDocuments,
  queryKnowledgeBase,
} from '#/api/ai';
import { requestClient } from '#/api/request';
import { $t } from '#/locales';

const emits = defineEmits<{ reload: [] }>();

const docUploading = ref(false);
const testQuery = ref('');
const testAnswer = ref('');
const testLoading = ref(false);

const [Drawer, drawerApi] = useVbenDrawer<AiApi.KnowledgeBase | null>({
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
          const kb = drawerApi.getData();
          if (!kb) return { items: [], total: 0 };
          const res = await listDocuments(kb.id, {
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
  const formData = new FormData();
  formData.append('file', file);
  const kb = drawerApi.getData();
  if (!kb) return false;
  try {
    await requestClient.post(
      `/ai/knowledge-bases/${kb.id}/documents`,
      formData,
    );
    message.success($t('common.success'));
    gridApi.query();
    emits('reload');
  } finally {
    docUploading.value = false;
  }
  return false;
}

function onDeleteDoc(row: AiApi.KbDocument) {
  const kb = drawerApi.getData();
  if (!kb) return;
  deleteDocument(kb.id, row.id).then(() => {
    message.success($t('common.success'));
    gridApi.query();
    emits('reload');
  });
}

async function onTestQuery() {
  if (!testQuery.value.trim()) return;
  const kb = drawerApi.getData();
  if (!kb) return;
  testLoading.value = true;
  testAnswer.value = '';
  try {
    testAnswer.value = await queryKnowledgeBase(kb.id, testQuery.value);
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

defineExpose({ drawerApi });
</script>

<template>
  <Drawer :title="drawerApi.getData()?.name ?? ''" :width="760">
    <div class="mb-4 flex items-center gap-3">
      <Upload :before-upload="onUpload" accept=".pdf,.md,.txt" :show-upload-list="false">
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

    <Card :title="$t('page.ai.knowledge.testQuery')" size="small">
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
    </Card>
  </Drawer>
</template>
