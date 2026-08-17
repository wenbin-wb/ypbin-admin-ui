<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Search } from '@vben/icons';

import {
  Alert,
  Badge,
  Button,
  Drawer,
  Empty,
  Input,
  message,
  Skeleton,
  Tooltip,
} from 'ant-design-vue';
import hljs from 'highlight.js';
import { marked } from 'marked';

import {
  getDocumentContent,
  getDocumentList,
  getKnowledgeBaseList,
  queryKnowledgeBaseWithSources,
} from '#/api/ai';
import { $t } from '#/locales';
import { sanitizeHtml } from '#/views/system/_shared/sanitize';

defineOptions({ name: 'AiWiki' });

const route = useRoute();

// ===== Markdown 渲染 =====
const markdownRenderer = new marked.Renderer();
markdownRenderer.code = ({ text, lang }: { lang?: string; text: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre class="wiki-code-block"><code class="hljs language-${language}">${highlighted}</code></pre>`;
};
marked.use({
  async: false,
  breaks: true,
  gfm: true,
  renderer: markdownRenderer,
});

function renderMd(content: string): string {
  if (!content) return '';
  try {
    const raw = marked.parse(content);
    return typeof raw === 'string' ? sanitizeHtml(raw) : content;
  } catch {
    return content;
  }
}

// ===== 状态 =====
const kbs = ref<AiApi.KnowledgeBase[]>([]);
const activeKbId = ref<string>('');
const docs = ref<AiApi.KbDocument[]>([]);
const activeDocId = ref<string>('');
const docContent = ref<string>('');
const docLoading = ref(false);
const kbLoading = ref(false);

// 全文搜索
const searchKeyword = ref('');
const searchResults = ref<AiApi.KbDocument[]>([]);

// AI 问答浮窗
const aiDrawerOpen = ref(false);
const aiQuestion = ref('');
const aiLoading = ref(false);
const aiResult = ref<AiApi.KbQueryResult | null>(null);

const activeKb = computed(() =>
  kbs.value.find((k) => k.id === activeKbId.value),
);
const activeDoc = computed(() =>
  docs.value.find((d) => d.id === activeDocId.value),
);

const filteredDocs = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return docs.value.filter((d) => d.status === 1);
  return docs.value.filter(
    (d) => d.status === 1 && d.filename.toLowerCase().includes(kw),
  );
});

// ===== 加载 =====
async function loadKbs() {
  kbLoading.value = true;
  try {
    kbs.value = await getKnowledgeBaseList();
    const routeKbId = route.params.kbId as string;
    if (routeKbId && kbs.value.some((k) => k.id === routeKbId)) {
      activeKbId.value = routeKbId;
    } else if (kbs.value.length > 0) {
      activeKbId.value = kbs.value[0]?.id ?? '';
    }
  } finally {
    kbLoading.value = false;
  }
  // 文档加载由 watch(activeKbId) 统一处理，避免与 watch 竞态清空 docs
}

async function loadDocs(kbId: string) {
  if (!kbId) return;
  const res = await getDocumentList(kbId, { page: 1, pageSize: 200 });
  docs.value = res.items ?? [];
  // 默认打开第一个就绪文档
  const first = docs.value.find((d) => d.status === 1);
  if (first) await openDoc(first.id);
}

async function openDoc(docId: string) {
  if (activeDocId.value === docId) return;
  activeDocId.value = docId;
  docContent.value = '';
  docLoading.value = true;
  try {
    docContent.value = await getDocumentContent(activeKbId.value, docId);
  } finally {
    docLoading.value = false;
  }
}

// ===== AI 问答 =====
async function onAskAi() {
  if (!aiQuestion.value.trim() || aiLoading.value) return;
  aiLoading.value = true;
  aiResult.value = null;
  try {
    aiResult.value = await queryKnowledgeBaseWithSources(
      activeKbId.value,
      aiQuestion.value,
    );
  } catch {
    message.error($t('common.requestFailed'));
  } finally {
    aiLoading.value = false;
  }
}

function openAiDrawer() {
  aiDrawerOpen.value = true;
  aiQuestion.value = '';
  aiResult.value = null;
}

// ===== 全文搜索（前端过滤文档名，后续可改为向量检索） =====
watch(searchKeyword, () => {
  searchResults.value = [];
});

// ===== 监听知识库切换（immediate:true 保证初始化也触发） =====
watch(
  activeKbId,
  async (id) => {
    if (id) {
      docs.value = [];
      activeDocId.value = '';
      docContent.value = '';
      await loadDocs(id);
    }
  },
  { immediate: true },
);

onMounted(loadKbs);
</script>

<template>
  <Page auto-content-height content-class="p-0">
    <div class="wiki-layout">
      <!-- 左侧：知识库切换 + 文档树 -->
      <aside class="wiki-sidebar">
        <div class="wiki-sidebar-header">
          <span class="wiki-logo-text">📚 Wiki</span>
          <Tooltip :title="$t('page.ai.wiki.askAi')">
            <Button size="small" type="primary" @click="openAiDrawer">
              AI
            </Button>
          </Tooltip>
        </div>

        <!-- 知识库切换 -->
        <div v-if="kbs.length > 1" class="wiki-kb-tabs">
          <div
            v-for="kb in kbs"
            :key="kb.id"
            class="wiki-kb-tab"
            :class="{ active: kb.id === activeKbId }"
            @click="activeKbId = kb.id"
          >
            {{ kb.name }}
          </div>
        </div>

        <!-- 搜索框 -->
        <div class="wiki-search">
          <Input
            v-model:value="searchKeyword"
            :placeholder="$t('page.ai.wiki.searchPlaceholder')"
            allow-clear
            size="small"
          >
            <template #prefix>
              <Search class="size-3.5 text-muted-foreground" />
            </template>
          </Input>
        </div>

        <!-- 文档列表 -->
        <div class="wiki-doc-list">
          <div v-if="kbLoading" class="wiki-doc-skeleton">
            <Skeleton active :paragraph="{ rows: 4 }" />
          </div>
          <template v-else-if="filteredDocs.length > 0">
            <div
              v-for="doc in filteredDocs"
              :key="doc.id"
              class="wiki-doc-item"
              :class="{ active: doc.id === activeDocId }"
              @click="openDoc(doc.id)"
            >
              <span class="wiki-doc-icon">📄</span>
              <span class="wiki-doc-name">{{ doc.filename }}</span>
            </div>
          </template>
          <div v-else class="wiki-empty-tip">
            {{
              searchKeyword
                ? $t('page.ai.wiki.noSearchResult')
                : $t('page.ai.wiki.noDocs')
            }}
          </div>
        </div>
      </aside>

      <!-- 主区域：文档阅读 -->
      <main class="wiki-main">
        <!-- 顶部面包屑 -->
        <header class="wiki-topbar">
          <span class="wiki-breadcrumb">
            <span class="text-muted-foreground">{{ activeKb?.name }}</span>
            <template v-if="activeDoc">
              <span class="mx-2 text-muted-foreground">/</span>
              <span>{{ activeDoc.filename }}</span>
            </template>
          </span>
          <Button size="small" @click="openAiDrawer">
            💬 {{ $t('page.ai.wiki.askAi') }}
          </Button>
        </header>

        <!-- 文档内容 -->
        <div class="wiki-content">
          <Skeleton v-if="docLoading" active :paragraph="{ rows: 12 }" />
          <div
            v-else-if="docContent"
            class="wiki-markdown"
            v-html="renderMd(docContent)"
          ></div>
          <div v-else class="wiki-welcome">
            <Empty :description="$t('page.ai.wiki.selectDoc')" class="pt-24" />
          </div>
        </div>
      </main>

      <!-- AI 问答浮窗（Drawer） -->
      <Drawer
        v-model:open="aiDrawerOpen"
        :title="$t('page.ai.wiki.aiDrawerTitle')"
        placement="right"
        :width="420"
        :body-style="{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }"
      >
        <Input.Search
          v-model:value="aiQuestion"
          :enter-button="$t('page.ai.wiki.ask')"
          :loading="aiLoading"
          :placeholder="$t('page.ai.wiki.askPlaceholder')"
          class="mb-4"
          @search="onAskAi"
        />

        <template v-if="aiResult">
          <!-- 答案 -->
          <Alert
            :message="aiResult.answer"
            class="mb-4 whitespace-pre-wrap"
            show-icon
            type="info"
          />

          <!-- 溯源片段 -->
          <template v-if="aiResult.sources?.length">
            <div class="mb-2 flex items-center gap-2 text-sm font-medium">
              {{ $t('page.ai.wiki.sources') }}（{{ aiResult.sources.length }}）
            </div>
            <div class="flex flex-col gap-2 overflow-y-auto">
              <div
                v-for="(frag, idx) in aiResult.sources"
                :key="idx"
                class="rounded-md border border-border bg-muted/40 p-3"
              >
                <div class="mb-1 flex items-center gap-2">
                  <Badge
                    :count="idx + 1"
                    :number-style="{ backgroundColor: 'hsl(var(--primary))' }"
                  />
                  <span class="truncate text-xs text-muted-foreground">
                    {{ frag.source }}
                  </span>
                </div>
                <p class="m-0 text-[13px] leading-relaxed">
                  {{ frag.content }}
                </p>
              </div>
            </div>
          </template>
        </template>

        <div
          v-else-if="!aiLoading"
          class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
        >
          {{ $t('page.ai.wiki.askHint') }}
        </div>
      </Drawer>
    </div>
  </Page>
</template>

<style scoped>
.wiki-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: hsl(var(--background));
}

/* ===== 左侧栏 ===== */
.wiki-sidebar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 260px;
  height: 100%;
  overflow: hidden;
  background: hsl(var(--card));
  border-right: 1px solid hsl(var(--border));
}

.wiki-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.wiki-logo-text {
  font-size: 15px;
  font-weight: 600;
}

.wiki-kb-tabs {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border-bottom: 1px solid hsl(var(--border));
}

.wiki-kb-tab {
  padding: 6px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}

.wiki-kb-tab:hover {
  background: hsl(var(--muted));
}

.wiki-kb-tab.active {
  font-weight: 500;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.wiki-search {
  padding: 10px 12px 8px;
}

.wiki-doc-list {
  flex: 1;
  padding: 4px 8px 16px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.wiki-doc-skeleton {
  padding: 16px;
}

.wiki-doc-item {
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 7px 10px;
  cursor: pointer;
  user-select: none;
  border-radius: 6px;
  transition: background 0.15s;
}

.wiki-doc-item:hover {
  background: hsl(var(--muted));
}

.wiki-doc-item.active {
  font-weight: 500;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.wiki-doc-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.wiki-doc-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  white-space: nowrap;
}

.wiki-empty-tip {
  padding: 24px 12px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

/* ===== 主区域 ===== */
.wiki-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.wiki-topbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
}

.wiki-breadcrumb {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  white-space: nowrap;
}

.wiki-content {
  flex: 1;
  padding: 32px min(10vw, 80px);
  overflow-y: auto;
  scrollbar-width: thin;
}

.wiki-welcome {
  padding-top: 60px;
}

/* ===== Markdown 排版 ===== */
.wiki-markdown {
  max-width: 820px;
  margin: 0 auto;
  font-size: 15px;
  line-height: 1.8;
  color: hsl(var(--foreground));
  overflow-wrap: break-word;
}

.wiki-markdown :deep(h1) {
  padding-bottom: 12px;
  margin: 0 0 24px;
  font-size: 28px;
  font-weight: 700;
  border-bottom: 2px solid hsl(var(--border));
}

.wiki-markdown :deep(h2) {
  margin: 32px 0 12px;
  font-size: 20px;
  font-weight: 600;
}

.wiki-markdown :deep(h3) {
  margin: 24px 0 8px;
  font-size: 17px;
  font-weight: 600;
}

.wiki-markdown :deep(p) {
  margin: 0 0 14px;
}

.wiki-markdown :deep(ul),
.wiki-markdown :deep(ol) {
  padding-left: 24px;
  margin: 8px 0 14px;
}

.wiki-markdown :deep(li) {
  margin: 5px 0;
}

.wiki-markdown :deep(blockquote) {
  padding: 10px 16px;
  margin: 14px 0;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 50%);
  border-left: 4px solid hsl(var(--primary) / 60%);
  border-radius: 0 6px 6px 0;
}

.wiki-markdown :deep(a) {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 3px;
}

.wiki-markdown :deep(code:not(.hljs)) {
  padding: 2px 6px;
  font-family:
    ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  background: hsl(var(--secondary));
  border-radius: 4px;
}

.wiki-markdown :deep(.wiki-code-block) {
  margin: 16px 0;
  overflow-x: auto;
  background: hsl(var(--secondary));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.wiki-markdown :deep(.wiki-code-block code) {
  display: block;
  padding: 16px;
  font-family:
    ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  color: hsl(var(--foreground));
}

.wiki-markdown :deep(table) {
  width: 100%;
  margin: 14px 0;
  font-size: 14px;
  border-collapse: collapse;
}

.wiki-markdown :deep(th),
.wiki-markdown :deep(td) {
  padding: 8px 12px;
  text-align: left;
  border: 1px solid hsl(var(--border));
}

.wiki-markdown :deep(th) {
  font-weight: 600;
  background: hsl(var(--secondary));
}

.wiki-markdown :deep(hr) {
  margin: 24px 0;
  border: none;
  border-top: 1px solid hsl(var(--border));
}

.wiki-markdown :deep(img) {
  max-width: 100%;
  border-radius: 6px;
}
</style>
