<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Button,
  Drawer,
  Empty,
  Input,
  message,
  Skeleton,
  Spin,
  Tag,
} from 'ant-design-vue';
import hljs from 'highlight.js';
// ===== Markdown 渲染 =====
import { marked } from 'marked';

import {
  getDocumentContent,
  getDocumentList,
  getKnowledgeBaseList,
  queryKnowledgeBaseWithSources,
} from '#/api/ai';
import { $t } from '#/locales';
import { sanitizeHtml } from '#/views/system/_shared/sanitize';

marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderer = new marked.Renderer();
renderer.code = function ({ text, lang }) {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre class="hljs-pre"><code class="hljs language-${language}">${highlighted}</code></pre>`;
};
marked.use({ renderer });

function renderMarkdown(md: string): string {
  if (!md) return '';
  return sanitizeHtml(marked.parse(md) as string);
}

// ===== 状态 =====
const route = useRoute();

const kbs = ref<AiApi.KnowledgeBase[]>([]);
const kbLoading = ref(false);

const activeKbId = ref<string>('');
const docs = ref<AiApi.KbDocument[]>([]);
const docsLoading = ref(false);

const activeDocId = ref<string>('');
const docContent = ref('');
const docLoading = ref(false);
const docError = ref('');

const searchKeyword = ref('');

const aiDrawerOpen = ref(false);
const aiQuestion = ref('');
const aiResult = ref<AiApi.KbQueryResult | null>(null);
const aiLoading = ref(false);

// ===== 计算属性 =====
const filteredDocs = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return docs.value;
  return docs.value.filter((d) => d.filename.toLowerCase().includes(kw));
});

const activeDoc = computed(() =>
  docs.value.find((d) => d.id === activeDocId.value),
);

const renderedContent = computed(() => renderMarkdown(docContent.value));

// ===== 知识库列表 =====
async function loadKbs() {
  kbLoading.value = true;
  try {
    kbs.value = await getKnowledgeBaseList();
    const routeKbId = route.params.kbId as string | undefined;
    if (routeKbId && kbs.value.some((k) => k.id === routeKbId)) {
      activeKbId.value = routeKbId;
    } else if (kbs.value.length > 0) {
      activeKbId.value = kbs.value[0]?.id ?? '';
    }
  } finally {
    kbLoading.value = false;
  }
}

// ===== 文档列表 =====
async function loadDocs(kbId: string) {
  docsLoading.value = true;
  docs.value = [];
  activeDocId.value = '';
  docContent.value = '';
  docError.value = '';
  try {
    const res = await getDocumentList(kbId, { page: 1, pageSize: 200 });
    // 只展示就绪文档
    docs.value = (res.items ?? []).filter((d) => d.status === 1);
    // 自动加载第一篇
    if (docs.value.length > 0) {
      await openDoc(docs.value[0]?.id ?? '');
    }
  } finally {
    docsLoading.value = false;
  }
}

// ===== 打开文档 =====
async function openDoc(docId: string) {
  if (activeDocId.value === docId) return;
  activeDocId.value = docId;
  docContent.value = '';
  docError.value = '';
  docLoading.value = true;
  try {
    docContent.value = await getDocumentContent(activeKbId.value, docId);
  } catch (error: any) {
    docError.value = error?.message || $t('common.requestFailed');
  } finally {
    docLoading.value = false;
  }
}

// ===== AI 问答 =====
function openAiDrawer() {
  aiDrawerOpen.value = true;
  aiQuestion.value = '';
  aiResult.value = null;
}

async function onAsk() {
  if (!aiQuestion.value.trim() || !activeKbId.value) return;
  aiLoading.value = true;
  aiResult.value = null;
  try {
    aiResult.value = await queryKnowledgeBaseWithSources(
      activeKbId.value,
      aiQuestion.value,
    );
  } catch (error: any) {
    message.error(error?.message || $t('common.requestFailed'));
  } finally {
    aiLoading.value = false;
  }
}

// ===== 知识库切换 watch =====
watch(
  activeKbId,
  (id) => {
    if (id) loadDocs(id);
  },
  { immediate: true },
);

onMounted(loadKbs);
</script>

<template>
  <Page auto-content-height content-class="p-0">
    <div class="wiki-layout h-full">
      <!-- ===== 左侧：知识库切换 + 文档树 ===== -->
      <aside
        class="wiki-sidebar flex h-full flex-col border-r border-border bg-card"
      >
        <!-- 头部 -->
        <div class="flex items-center gap-2 border-b border-border px-4 py-3">
          <span class="text-base font-bold">📚 Wiki</span>
        </div>

        <!-- 知识库切换 -->
        <div class="border-b border-border px-3 py-2">
          <Skeleton
            v-if="kbLoading"
            :active="true"
            :paragraph="{ rows: 1 }"
            class="px-1 py-1"
          />
          <template v-else>
            <div
              v-for="kb in kbs"
              :key="kb.id"
              class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors"
              :class="[
                activeKbId === kb.id
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-foreground/70 hover:bg-accent',
              ]"
              @click="activeKbId = kb.id"
            >
              <span class="text-base leading-none">{{ kb.icon || '📖' }}</span>
              <span class="truncate">{{ kb.name }}</span>
            </div>
          </template>
        </div>

        <!-- 搜索 -->
        <div class="px-3 py-2">
          <Input
            v-model:value="searchKeyword"
            :placeholder="$t('page.ai.wiki.searchPlaceholder')"
            allow-clear
            size="small"
          />
        </div>

        <!-- 文档列表 -->
        <div class="flex-1 overflow-y-auto px-2 py-1">
          <template v-if="docsLoading">
            <Skeleton
              v-for="i in 5"
              :key="i"
              :active="true"
              :title="{ width: '80%' }"
              :paragraph="false"
              class="my-1 px-2"
            />
          </template>
          <Empty
            v-else-if="filteredDocs.length === 0 && !docsLoading"
            :description="
              searchKeyword
                ? $t('page.ai.wiki.noSearchResult')
                : $t('page.ai.wiki.noDocs')
            "
            class="py-8"
          />
          <div
            v-else
            v-for="doc in filteredDocs"
            :key="doc.id"
            class="group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors"
            :class="[
              activeDocId === doc.id
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-foreground/70 hover:bg-accent',
            ]"
            @click="openDoc(doc.id)"
          >
            <span
              class="i-lucide-file-text size-3.5 shrink-0 opacity-60"
            ></span>
            <span class="truncate">{{ doc.filename }}</span>
          </div>
        </div>

        <!-- 底部：AI 问答按钮 -->
        <div class="border-t border-border p-3">
          <Button
            block
            type="primary"
            :disabled="!activeKbId"
            class="gap-1"
            @click="openAiDrawer"
          >
            💬 {{ $t('page.ai.wiki.askAi') }}
          </Button>
        </div>
      </aside>

      <!-- ===== 主区域：文档内容 ===== -->
      <main
        class="wiki-content flex h-full flex-col overflow-hidden bg-background"
      >
        <!-- 面包屑 / 文档标题 -->
        <div
          v-if="activeDoc"
          class="flex items-center gap-3 border-b border-border px-6 py-3"
        >
          <span class="i-lucide-file-text size-4 text-muted-foreground"></span>
          <span class="text-sm font-medium">{{ activeDoc.filename }}</span>
          <Tag color="success" class="ml-auto">
            {{ $t('page.ai.knowledge.ready') }}
          </Tag>
        </div>

        <!-- 骨架屏（加载中） -->
        <div v-if="docLoading" class="flex-1 overflow-y-auto px-8 py-6">
          <Skeleton :active="true" :paragraph="{ rows: 12 }" />
        </div>

        <!-- 错误提示 -->
        <div
          v-else-if="docError"
          class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
        >
          <span
            class="i-lucide-alert-circle size-10 text-destructive/60"
          ></span>
          <p class="text-sm">{{ docError }}</p>
          <Button @click="openDoc(activeDocId)">重新加载</Button>
        </div>

        <!-- 无文档 -->
        <div
          v-else-if="!activeDocId || !docContent"
          class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground"
        >
          <span class="i-lucide-book-open size-12 opacity-20"></span>
          <p class="text-sm">{{ $t('page.ai.wiki.selectDoc') }}</p>
        </div>

        <!-- Markdown 内容 -->
        <div v-else class="wiki-article flex-1 overflow-y-auto px-8 py-6">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            class="prose prose-sm dark:prose-invert max-w-none"
            v-html="renderedContent"
          ></div>
        </div>
      </main>
    </div>

    <!-- ===== AI 问答 Drawer ===== -->
    <Drawer
      v-model:open="aiDrawerOpen"
      :title="$t('page.ai.wiki.aiDrawerTitle')"
      :width="400"
      placement="right"
    >
      <div class="flex h-full flex-col gap-4">
        <!-- 输入区 -->
        <div class="flex gap-2">
          <Input
            v-model:value="aiQuestion"
            :placeholder="$t('page.ai.wiki.askPlaceholder')"
            class="flex-1"
            @keydown.enter="onAsk"
          />
          <Button :loading="aiLoading" type="primary" @click="onAsk">
            {{ $t('page.ai.wiki.ask') }}
          </Button>
        </div>

        <Spin :spinning="aiLoading">
          <!-- 答案 -->
          <div
            v-if="aiResult?.answer"
            class="mb-4 rounded-lg border border-border bg-muted/40 p-4"
          >
            <p class="mb-1.5 text-xs font-semibold text-primary">AI</p>
            <p class="whitespace-pre-wrap text-sm leading-relaxed">
              {{ aiResult.answer }}
            </p>
          </div>

          <!-- 溯源片段 -->
          <div v-if="aiResult?.sources?.length" class="flex flex-col gap-2">
            <p class="text-xs font-medium text-muted-foreground">
              {{ $t('page.ai.wiki.sources') }}（{{ aiResult.sources.length }}）
            </p>
            <div
              v-for="(src, idx) in aiResult.sources"
              :key="idx"
              class="rounded-lg border border-border bg-card p-3"
            >
              <div class="mb-1.5 flex items-center gap-2">
                <span
                  class="inline-flex size-4 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary"
                  >#{{ idx + 1 }}</span>
                <span class="truncate text-xs text-muted-foreground">{{
                  src.source
                }}</span>
              </div>
              <p class="m-0 text-xs leading-relaxed text-foreground/80">
                {{ src.content }}
              </p>
            </div>
          </div>

          <!-- 空态 -->
          <Empty
            v-else-if="!aiLoading && !aiResult"
            :description="$t('page.ai.wiki.askHint')"
            class="py-12"
          />
        </Spin>
      </div>
    </Drawer>
  </Page>
</template>

<style scoped>
.wiki-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
}

.wiki-sidebar {
  min-height: 0;
}

.wiki-content {
  min-height: 0;
}

/* Markdown prose 样式 */
.wiki-article :deep(.prose) {
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.4;
  }

  h1 {
    padding-bottom: 0.3em;
    font-size: 1.6em;
    border-bottom: 1px solid var(--border);
  }

  h2 {
    padding-bottom: 0.2em;
    font-size: 1.35em;
    border-bottom: 1px solid var(--border);
  }

  h3 {
    font-size: 1.1em;
  }

  p {
    margin: 0.75em 0;
    line-height: 1.75;
  }

  a {
    color: hsl(var(--primary));
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  code {
    padding: 0.1em 0.35em;
    font-family: 'Fira Code', 'JetBrains Mono', monospace;
    font-size: 0.85em;
    background: hsl(var(--muted));
    border-radius: 3px;
  }

  .hljs-pre {
    margin: 1em 0;
    overflow: hidden;
    border-radius: 8px;
  }

  .hljs-pre code {
    display: block;
    padding: 1em 1.2em;
    overflow-x: auto;
    font-size: 0.82em;
    line-height: 1.6;
    background: hsl(var(--muted));
  }

  blockquote {
    padding: 0.25em 1em;
    margin: 1em 0;
    color: hsl(var(--muted-foreground));
    background: hsl(var(--muted) / 30%);
    border-left: 3px solid hsl(var(--primary) / 40%);
    border-radius: 0 4px 4px 0;
  }

  ul,
  ol {
    padding-left: 1.5em;
    margin: 0.75em 0;
  }

  li {
    margin: 0.25em 0;
  }

  table {
    width: 100%;
    margin: 1em 0;
    font-size: 0.9em;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 0.5em 0.75em;
    text-align: left;
    border: 1px solid hsl(var(--border));
  }

  th {
    font-weight: 600;
    background: hsl(var(--muted));
  }

  tr:hover td {
    background: hsl(var(--accent) / 30%);
  }

  hr {
    margin: 1.5em 0;
    border: none;
    border-top: 1px solid hsl(var(--border));
  }

  img {
    max-width: 100%;
    border-radius: 6px;
  }
}
</style>
