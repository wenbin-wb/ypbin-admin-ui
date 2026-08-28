<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Drawer,
  Empty,
  Input,
  message,
  Skeleton,
  Spin,
} from 'ant-design-vue';

import {
  getShareConfig,
  getShareDocumentContent,
  getShareDocuments,
  shareAsk,
} from '#/api/ai';
import { $t } from '#/locales';
import { useMarkdownRenderer } from '#/views/ai/_shared/useMarkdownRenderer';

const { renderMarkdown } = useMarkdownRenderer();

// ===== 状态 =====
const route = useRoute();
const token = String(route.params.token ?? '');

const config = ref<null | {
  description: string;
  docCount: number;
  expired: boolean;
  expireTime: string;
  icon: string;
  name: string;
  requirePassword: boolean;
}>(null);
const configError = ref('');

const password = ref(sessionStorage.getItem(`ypbin-share-pwd-${token}`) ?? '');
const pwdInput = ref('');
const verified = ref(false);
const checking = ref(false);

const docs = ref<AiApi.KbDocument[]>([]);
const docsLoading = ref(false);
const activeDocId = ref('');
const docContent = ref('');
const docLoading = ref(false);
const docError = ref('');

const aiDrawerOpen = ref(false);
const aiQuestion = ref('');
const aiAnswer = ref('');
const aiLoading = ref(false);

// ===== 计算属性 =====
const activeDoc = computed(() =>
  docs.value.find((d) => d.id === activeDocId.value),
);

const renderedContent = computed(() => renderMarkdown(docContent.value));

// ===== 文档加载 =====
async function loadDocs() {
  docsLoading.value = true;
  docs.value = [];
  activeDocId.value = '';
  docContent.value = '';
  docError.value = '';
  try {
    const res = await getShareDocuments(
      token,
      { page: 1, pageSize: 200 },
      password.value || undefined,
    );
    docs.value = (res.items ?? []).filter((d) => d.status === 1);
    if (docs.value.length > 0) {
      await openDoc(docs.value[0]?.id ?? '');
    }
  } finally {
    docsLoading.value = false;
  }
}

async function openDoc(docId: string) {
  if (activeDocId.value === docId) return;
  activeDocId.value = docId;
  docContent.value = '';
  docError.value = '';
  docLoading.value = true;
  try {
    docContent.value = await getShareDocumentContent(
      token,
      docId,
      password.value || undefined,
    );
  } catch (error: any) {
    docError.value = error?.message || $t('common.requestFailed');
  } finally {
    docLoading.value = false;
  }
}

// ===== 密码解锁 =====
async function unlock() {
  if (!pwdInput.value.trim()) {
    message.error($t('page.ai.share.passwordRequired'));
    return;
  }
  checking.value = true;
  try {
    password.value = pwdInput.value.trim();
    // 密码错误时文档列表接口会抛出业务异常
    await loadDocs();
    sessionStorage.setItem(`ypbin-share-pwd-${token}`, password.value);
    verified.value = true;
  } catch (error: any) {
    password.value = '';
    message.error(error?.message || $t('page.ai.share.passwordWrong'));
  } finally {
    checking.value = false;
  }
}

// ===== AI 问答 =====
function openAiDrawer() {
  aiDrawerOpen.value = true;
  aiQuestion.value = '';
  aiAnswer.value = '';
}

async function onAsk() {
  if (!aiQuestion.value.trim()) return;
  aiLoading.value = true;
  aiAnswer.value = '';
  try {
    aiAnswer.value = await shareAsk(
      token,
      aiQuestion.value,
      password.value || undefined,
    );
  } catch (error: any) {
    message.error(error?.message || $t('common.requestFailed'));
  } finally {
    aiLoading.value = false;
  }
}

// ===== 初始化 =====
onMounted(async () => {
  try {
    const cfg = await getShareConfig(token);
    config.value = cfg;
    if (cfg.expired) {
      return;
    }
    if (cfg.requirePassword) {
      // 有已存密码则尝试直接进入；失败回落到密码门
      if (password.value) {
        try {
          verified.value = true;
          await loadDocs();
        } catch {
          verified.value = false;
        }
      }
    } else {
      verified.value = true;
      await loadDocs();
    }
  } catch (error: any) {
    configError.value = error?.message || $t('page.ai.share.invalid');
  }
});
</script>

<template>
  <!-- 加载/错误/过期/密码门 -->
  <div v-if="!config && !configError" class="share-stage">
    <Skeleton
      :active="true"
      :paragraph="{ rows: 8 }"
      class="w-full max-w-2xl"
    />
  </div>

  <div v-else-if="configError" class="share-stage">
    <div class="flex flex-col items-center gap-3 text-muted-foreground">
      <span class="i-lucide-link-2-off size-12 opacity-30"></span>
      <p class="text-sm">{{ configError }}</p>
    </div>
  </div>

  <div v-else-if="config?.expired" class="share-stage">
    <div class="flex flex-col items-center gap-3 text-muted-foreground">
      <span class="i-lucide-hourglass size-12 opacity-30"></span>
      <p class="text-sm">{{ $t('page.ai.share.expired') }}</p>
    </div>
  </div>

  <!-- 密码门 -->
  <div v-else-if="config?.requirePassword && !verified" class="share-stage">
    <div
      class="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <div class="mb-2 flex items-center gap-2">
        <IconifyIcon icon="lucide:book-open" class="text-xl" />
        <span class="text-base font-semibold">{{ config.name }}</span>
      </div>
      <p class="mb-4 text-sm text-muted-foreground">
        {{ $t('page.ai.share.passwordGateHint') }}
      </p>
      <Input.Password
        v-model:value="pwdInput"
        :placeholder="$t('page.ai.share.passwordPlaceholder')"
        @keydown.enter="unlock"
      />
      <Button
        block
        type="primary"
        class="mt-4"
        :loading="checking"
        @click="unlock"
      >
        {{ $t('page.ai.share.unlock') }}
      </Button>
    </div>
  </div>

  <!-- 主阅读布局 -->
  <div v-else class="share-layout">
    <aside
      class="share-sidebar flex h-full flex-col border-r border-border bg-card"
    >
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <IconifyIcon icon="lucide:book-open" class="text-xl leading-none" />
        <span class="truncate text-sm font-bold">{{ config?.name }}</span>
      </div>

      <div class="flex-1 overflow-y-auto px-2 py-1">
        <template v-if="docsLoading">
          <Skeleton
            v-for="i in 6"
            :key="i"
            :active="true"
            :title="{ width: '80%' }"
            :paragraph="false"
            class="my-1 px-2"
          />
        </template>
        <Empty
          v-else-if="docs.length === 0"
          :description="$t('page.ai.share.noDocs')"
          class="py-12"
        />
        <div
          v-else
          v-for="doc in docs"
          :key="doc.id"
          class="group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors"
          :class="[
            activeDocId === doc.id
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-foreground/70 hover:bg-accent',
          ]"
          @click="openDoc(doc.id)"
        >
          <span class="i-lucide-file-text size-3.5 shrink-0 opacity-60"></span>
          <span class="truncate">{{ doc.filename }}</span>
        </div>
      </div>

      <div class="border-t border-border p-3">
        <Button
          block
          type="primary"
          :disabled="!config"
          class="gap-1"
          @click="openAiDrawer"
        >
          <IconifyIcon icon="lucide:message-square" />
          {{ $t('page.ai.share.askAi') }}
        </Button>
      </div>
    </aside>

    <main
      class="share-content flex h-full flex-col overflow-hidden bg-background"
    >
      <div
        v-if="activeDoc"
        class="flex items-center gap-3 border-b border-border px-6 py-3"
      >
        <span class="i-lucide-file-text size-4 text-muted-foreground"></span>
        <span class="truncate text-sm font-medium">{{
          activeDoc.filename
        }}</span>
      </div>

      <div v-if="docLoading" class="flex-1 overflow-y-auto px-8 py-6">
        <Skeleton :active="true" :paragraph="{ rows: 12 }" />
      </div>

      <div
        v-else-if="docError"
        class="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <span class="i-lucide-alert-circle size-10 text-destructive/60"></span>
        <p class="text-sm">{{ docError }}</p>
        <Button @click="openDoc(activeDocId)">
{{
          $t('page.ai.share.reload')
        }}
</Button>
      </div>

      <div
        v-else-if="!activeDocId || !docContent"
        class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground"
      >
        <span class="i-lucide-book-open size-12 opacity-20"></span>
        <p class="text-sm">{{ $t('page.ai.share.selectDoc') }}</p>
      </div>

      <div v-else class="share-article flex-1 overflow-y-auto px-8 py-6">
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="prose prose-sm dark:prose-invert max-w-none"
          v-html="renderedContent"
        ></div>
      </div>
    </main>
  </div>

  <!-- AI 问答 Drawer -->
  <Drawer
    v-model:open="aiDrawerOpen"
    :title="$t('page.ai.share.aiDrawerTitle')"
    :width="400"
    placement="right"
  >
    <div class="flex h-full flex-col gap-4">
      <div class="flex gap-2">
        <Input
          v-model:value="aiQuestion"
          :placeholder="$t('page.ai.share.askPlaceholder')"
          class="flex-1"
          @keydown.enter="onAsk"
        />
        <Button :loading="aiLoading" type="primary" @click="onAsk">
          {{ $t('page.ai.share.ask') }}
        </Button>
      </div>

      <Spin :spinning="aiLoading">
        <div
          v-if="aiAnswer"
          class="rounded-lg border border-border bg-muted/40 p-4"
        >
          <p class="mb-1.5 text-xs font-semibold text-primary">AI</p>
          <p class="whitespace-pre-wrap text-sm leading-relaxed">
            {{ aiAnswer }}
          </p>
        </div>
        <Empty
          v-else-if="!aiLoading"
          :description="$t('page.ai.share.askHint')"
          class="py-12"
        />
      </Spin>
    </div>
  </Drawer>
</template>

<style scoped>
.share-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: hsl(var(--background));
}

.share-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  height: 100vh;
  background: hsl(var(--background));
}

.share-sidebar {
  min-height: 0;
}

.share-content {
  min-height: 0;
}

/* Markdown prose 样式 */
.share-article :deep(.prose) {
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
