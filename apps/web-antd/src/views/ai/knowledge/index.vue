<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, onMounted, ref } from 'vue';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, Empty, message, Popconfirm } from 'ant-design-vue';

import { deleteKnowledgeBase, getKnowledgeBaseList } from '#/api/ai';
import { $t } from '#/locales';

import Documents from './modules/documents.vue';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [DocumentsModal, documentsModalApi] = useVbenModal({
  connectedComponent: Documents,
  destroyOnClose: false,
});

const knowledgeBases = ref<AiApi.KnowledgeBase[]>([]);
const loading = ref(false);
const keyword = ref('');

const filteredKbs = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return knowledgeBases.value;
  return knowledgeBases.value.filter(
    (kb) =>
      kb.name.toLowerCase().includes(kw) ||
      (kb.description ?? '').toLowerCase().includes(kw),
  );
});

async function loadKbs() {
  loading.value = true;
  try {
    knowledgeBases.value = await getKnowledgeBaseList();
  } finally {
    loading.value = false;
  }
}

function onCreate() {
  formDrawerApi.setData(null).open();
}

function onManageDocs(row: AiApi.KnowledgeBase) {
  documentsModalApi.setData(row).open();
}

async function onDelete(row: AiApi.KnowledgeBase) {
  await deleteKnowledgeBase(row.id);
  message.success($t('common.success'));
  await loadKbs();
}

onMounted(loadKbs);
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @reload="loadKbs" />
    <DocumentsModal @reload="loadKbs" />

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <Input
        v-model:value="keyword"
        :placeholder="$t('page.ai.knowledge.searchPlaceholder')"
        allow-clear
        class="max-w-56"
      />
      <Button
        v-access:code="['ai:knowledge:create']"
        type="primary"
        @click="onCreate"
      >
        <Plus class="size-5" />
        {{ $t('page.ai.knowledge.create') }}
      </Button>
    </div>

    <!-- 空态 -->
    <div
      v-if="!loading && filteredKbs.length === 0"
      class="flex justify-center py-24"
    >
      <Empty :description="$t('page.ai.knowledge.empty')" />
    </div>

    <!-- 知识库卡片网格 -->
    <div
      v-else
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <div
        v-for="kb in filteredKbs"
        :key="kb.id"
        class="group flex cursor-pointer flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
        @click="onManageDocs(kb)"
      >
        <div class="mb-2 flex items-start justify-between">
          <div class="flex items-center gap-2">
            <span
              class="flex size-8 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
              >KB</span>
            <span class="truncate text-base font-semibold">{{ kb.name }}</span>
          </div>
        </div>

        <p class="mb-3 line-clamp-2 flex-1 text-sm text-muted-foreground">
          {{ kb.description || $t('page.ai.knowledge.noDescription') }}
        </p>

        <div class="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <span class="inline-block size-1.5 rounded-full bg-primary"></span>
            {{ kb.docCount }} {{ $t('page.ai.knowledge.docCountSuffix') }}
          </span>
        </div>

        <div
          class="flex items-center justify-end gap-2 border-t border-border pt-3"
        >
          <Button size="small" @click.stop="onManageDocs(kb)">
            {{ $t('page.ai.knowledge.manageDocs') }}
          </Button>
          <Popconfirm
            :title="$t('page.ai.knowledge.confirmDeleteKb')"
            @confirm="onDelete(kb)"
          >
            <Button size="small" danger type="text" @click.stop>
              {{ $t('common.delete') }}
            </Button>
          </Popconfirm>
        </div>
      </div>
    </div>
  </Page>
</template>
