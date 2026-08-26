<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, onMounted, ref } from 'vue';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { useAppConfig } from '@vben/hooks';
import { Plus } from '@vben/icons';

import {
  Button,
  DatePicker,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Skeleton,
  Switch,
  Tooltip,
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';

import {
  deleteKnowledgeBase,
  getKnowledgeBaseList,
  setShareSetting,
  setWidgetEnabled,
} from '#/api/ai';
import { $t } from '#/locales';

import Documents from './modules/documents.vue';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
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

function onEdit(kb: AiApi.KnowledgeBase, e: Event) {
  e.stopPropagation();
  formDrawerApi.setData(kb).open();
}

function onManageDocs(row: AiApi.KnowledgeBase) {
  documentsModalApi.setData(row).open();
}

async function onDelete(row: AiApi.KnowledgeBase) {
  await deleteKnowledgeBase(row.id);
  message.success($t('common.success'));
  await loadKbs();
}

// ---- 网页挂件 ----
const widgetKb = ref<AiApi.KnowledgeBase | null>(null);
const widgetToken = ref('');
const widgetLoading = ref(false);
const widgetOpen = ref(false);

function onWidget(row: AiApi.KnowledgeBase, e: Event) {
  e.stopPropagation();
  widgetKb.value = row;
  widgetToken.value = row.widgetToken || '';
  widgetOpen.value = true;
}

async function onWidgetEnable() {
  const kb = widgetKb.value;
  if (!kb) return;
  widgetLoading.value = true;
  try {
    const token = await setWidgetEnabled(kb.id, true);
    widgetToken.value = token;
    kb.widgetToken = token;
    kb.widgetEnabled = 1;
    message.success($t('common.success'));
  } catch (error: any) {
    message.error(error?.message || $t('common.requestFailed'));
  } finally {
    widgetLoading.value = false;
  }
}

async function onWidgetDisable() {
  const kb = widgetKb.value;
  if (!kb) return;
  widgetLoading.value = true;
  try {
    await setWidgetEnabled(kb.id, false);
    widgetToken.value = '';
    kb.widgetToken = '';
    kb.widgetEnabled = 0;
    message.success($t('page.ai.knowledge.widgetDisabled'));
  } catch (error: any) {
    message.error(error?.message || $t('common.requestFailed'));
  } finally {
    widgetLoading.value = false;
  }
}

function widgetEmbedCode(token: string) {
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  // 用 \\u002F 转义 script 结束标签，避免提前终止本组件的 setup 块
  return (
    `<scr` +
    `ipt src="${apiURL}/widget/embed.js" data-token="${
      token
    }" data-title="${widgetKb.value?.name || ''}"><\u002Fscript>`
  );
}

async function onCopyCode() {
  const code = widgetEmbedCode(widgetToken.value);
  try {
    await navigator.clipboard.writeText(code);
    message.success($t('page.ai.knowledge.widgetCopied'));
  } catch {
    message.error($t('common.requestFailed'));
  }
}

// ---- 公开分享 ----
const shareKb = ref<AiApi.KnowledgeBase | null>(null);
const shareOpen = ref(false);
const shareEnabled = ref(false);
const shareExpire = ref<Dayjs | undefined>(undefined);
const sharePassword = ref('');
const shareToken = ref('');
const shareSaving = ref(false);

function shareLink(token: string) {
  return `${window.location.origin}/share/${token}`;
}

function onShare(row: AiApi.KnowledgeBase, e: Event) {
  e.stopPropagation();
  shareKb.value = row;
  shareEnabled.value = row.shareEnabled === 1;
  shareToken.value = row.shareToken || '';
  shareExpire.value = row.shareExpireTime ? dayjs(row.shareExpireTime) : undefined;
  sharePassword.value = '';
  shareOpen.value = true;
}

async function onShareEnable() {
  const kb = shareKb.value;
  if (!kb) return;
  shareSaving.value = true;
  try {
    const token = await setShareSetting(kb.id, { enabled: true });
    shareToken.value = token;
    shareEnabled.value = true;
    kb.shareToken = token;
    kb.shareEnabled = 1;
    message.success($t('page.ai.knowledge.shareEnabled'));
  } catch (error: any) {
    message.error(error?.message || $t('common.requestFailed'));
  } finally {
    shareSaving.value = false;
  }
}

async function onShareSave() {
  const kb = shareKb.value;
  if (!kb) return;
  shareSaving.value = true;
  try {
    const token = await setShareSetting(kb.id, {
      enabled: true,
      expireTime: shareExpire.value
        ? shareExpire.value.format('YYYY-MM-DDTHH:mm:ss')
        : null,
      password: sharePassword.value.trim() || undefined,
    });
    shareToken.value = token;
    kb.shareToken = token;
    kb.shareEnabled = 1;
    kb.shareExpireTime = shareExpire.value
      ? shareExpire.value.format('YYYY-MM-DDTHH:mm:ss')
      : '';
    sharePassword.value = '';
    message.success($t('common.success'));
  } catch (error: any) {
    message.error(error?.message || $t('common.requestFailed'));
  } finally {
    shareSaving.value = false;
  }
}

async function onShareDisable() {
  const kb = shareKb.value;
  if (!kb) return;
  shareSaving.value = true;
  try {
    await setShareSetting(kb.id, { enabled: false });
    shareEnabled.value = false;
    shareToken.value = '';
    shareExpire.value = undefined;
    sharePassword.value = '';
    kb.shareToken = '';
    kb.shareEnabled = 0;
    kb.shareExpireTime = '';
    message.success($t('page.ai.knowledge.shareDisabled'));
  } catch (error: any) {
    message.error(error?.message || $t('common.requestFailed'));
  } finally {
    shareSaving.value = false;
  }
}

async function onCopyShareLink() {
  try {
    await navigator.clipboard.writeText(shareLink(shareToken.value));
    message.success($t('page.ai.knowledge.shareCopied'));
  } catch {
    message.error($t('common.requestFailed'));
  }
}

/** 取知识库默认展示图标：优先 icon 字段，否则取名称首字 */
function kbIcon(kb: AiApi.KnowledgeBase) {
  if (kb.icon && kb.icon.trim()) return kb.icon.trim();
  return kb.name.charAt(0).toUpperCase();
}

/** 根据知识库 ID 生成一个稳定的背景色（从预设色盘中取） */
const COLOR_PALETTE = [
  'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
];
function kbColor(kb: AiApi.KnowledgeBase) {
  // 用 id 末两位数值取色
  const n = Number.parseInt(kb.id.slice(-2), 16) || 0;
  return COLOR_PALETTE[n % COLOR_PALETTE.length];
}

onMounted(loadKbs);
</script>

<template>
  <Page auto-content-height content-class="p-4">
    <FormDrawer @reload="loadKbs" />
    <DocumentsModal @reload="loadKbs" />

    <!-- 网页挂件弹窗 -->
    <Modal
      v-model:open="widgetOpen"
      :footer="null"
      :title="$t('page.ai.knowledge.widget')"
      width="560px"
    >
      <div v-if="widgetKb" class="space-y-4 py-2">
        <p class="text-sm text-muted-foreground">
          {{ $t('page.ai.knowledge.widgetHint') }}
        </p>

        <template v-if="widgetToken">
          <p class="text-sm font-medium">
            {{ $t('page.ai.knowledge.widgetCodeLabel') }}
          </p>
          <pre
            class="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-3 text-xs leading-relaxed"
            >{{ widgetEmbedCode(widgetToken) }}</pre>
          <Button size="small" @click="onCopyCode">
            {{ $t('page.ai.knowledge.widgetCopy') }}
          </Button>
          <div class="mt-4 flex justify-end">
            <Button danger :loading="widgetLoading" @click="onWidgetDisable">
              {{ $t('page.ai.knowledge.widgetDisable') }}
            </Button>
          </div>
        </template>

        <template v-else>
          <p class="text-sm">
            {{ $t('page.ai.knowledge.widgetNotEnabled') }}
          </p>
          <div class="mt-4 flex justify-end">
            <Button
              :loading="widgetLoading"
              type="primary"
              @click="onWidgetEnable"
            >
              {{ $t('page.ai.knowledge.widgetEnable') }}
            </Button>
          </div>
        </template>
      </div>
    </Modal>

    <!-- 公开分享弹窗 -->
    <Modal
      v-model:open="shareOpen"
      :footer="null"
      :title="$t('page.ai.knowledge.share')"
      width="560px"
    >
      <div v-if="shareKb" class="space-y-4 py-2">
        <div class="flex items-center justify-between gap-4">
          <p class="text-sm text-muted-foreground">
            {{ $t('page.ai.knowledge.shareHint') }}
          </p>
          <Switch v-model:checked="shareEnabled" :disabled="shareSaving" />
        </div>

        <template v-if="shareEnabled && shareToken">
          <div>
            <p class="mb-1.5 text-sm font-medium">
              {{ $t('page.ai.knowledge.shareLinkLabel') }}
            </p>
            <div class="flex gap-2">
              <Input
                :model-value="shareLink(shareToken)"
                read-only
                class="flex-1"
              />
              <Button size="small" @click="onCopyShareLink">
                {{ $t('page.ai.knowledge.shareCopy') }}
              </Button>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ $t('page.ai.knowledge.shareLinkHint') }}
            </p>
          </div>

          <div>
            <p class="mb-1.5 text-sm font-medium">
              {{ $t('page.ai.knowledge.shareExpire') }}
            </p>
            <DatePicker
              v-model:value="shareExpire"
              :placeholder="$t('page.ai.knowledge.shareExpirePlaceholder')"
              show-time
              class="w-full"
            />
          </div>

          <div>
            <p class="mb-1.5 text-sm font-medium">
              {{ $t('page.ai.knowledge.sharePassword') }}
            </p>
            <Input.Password
              v-model:value="sharePassword"
              :placeholder="$t('page.ai.knowledge.sharePasswordPlaceholder')"
              allow-clear
            />
            <p class="mt-1 text-xs text-muted-foreground">
              {{ $t('page.ai.knowledge.sharePasswordHint') }}
            </p>
          </div>

          <div class="flex justify-end gap-2">
            <Button
              danger
              :loading="shareSaving"
              @click="onShareDisable"
            >
              {{ $t('page.ai.knowledge.shareDisable') }}
            </Button>
            <Button
              :loading="shareSaving"
              type="primary"
              @click="onShareSave"
            >
              {{ $t('page.ai.knowledge.shareSave') }}
            </Button>
          </div>
        </template>

        <template v-else>
          <p class="text-sm">
            {{ $t('page.ai.knowledge.shareNotEnabled') }}
          </p>
          <div class="mt-4 flex justify-end">
            <Button
              :loading="shareSaving"
              type="primary"
              @click="onShareEnable"
            >
              {{ $t('page.ai.knowledge.shareEnable') }}
            </Button>
          </div>
        </template>
      </div>
    </Modal>

    <div class="flex h-full flex-col rounded-lg bg-background p-5 shadow-sm">
      <!-- 顶栏 -->
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <h2 class="text-base font-semibold leading-none">
            {{ $t('page.ai.knowledge.title') }}
          </h2>
          <span class="text-sm text-muted-foreground">（{{ knowledgeBases.length }}）</span>
        </div>
        <div class="flex items-center gap-2">
          <Input
            v-model:value="keyword"
            :placeholder="$t('page.ai.knowledge.searchPlaceholder')"
            allow-clear
            class="w-44"
          />
          <Button
            v-access:code="['ai:knowledge:create']"
            type="primary"
            @click="onCreate"
          >
            <Plus class="size-4" />
            {{ $t('page.ai.knowledge.create') }}
          </Button>
        </div>
      </div>

      <!-- 骨架屏 -->
      <div
        v-if="loading"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <Skeleton
          v-for="i in 4"
          :key="i"
          :active="true"
          :paragraph="{ rows: 3 }"
          class="rounded-lg border border-border p-5"
        />
      </div>

      <!-- 空态 -->
      <div
        v-else-if="filteredKbs.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-4 py-24"
      >
        <Empty
          :description="
            keyword
              ? $t('page.ai.knowledge.noSearchResult')
              : $t('page.ai.knowledge.empty')
          "
        />
        <Button
          v-if="!keyword"
          v-access:code="['ai:knowledge:create']"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-4" />
          {{ $t('page.ai.knowledge.create') }}
        </Button>
      </div>

      <!-- 知识库卡片网格 -->
      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <div
          v-for="kb in filteredKbs"
          :key="kb.id"
          class="group relative flex cursor-pointer flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          @click="onManageDocs(kb)"
        >
          <!-- 操作按钮（挂件/分享始终显示，编辑/删除 hover 显示） -->
          <div class="absolute right-3 top-3 flex items-center gap-1">
            <Tooltip :title="$t('page.ai.knowledge.widget')">
              <Button
                v-access:code="['ai:knowledge:create']"
                size="small"
                type="text"
                class="size-7 p-0"
                :class="
                  kb.widgetEnabled === 1
                    ? 'text-primary hover:text-primary/80'
                    : 'text-slate-400 hover:text-slate-600'
                "
                @click="onWidget(kb, $event)"
              >
                <span class="i-lucide-globe-2 size-3.5"></span>
              </Button>
            </Tooltip>
            <Tooltip :title="$t('page.ai.knowledge.share')">
              <Button
                v-access:code="['ai:knowledge:create']"
                size="small"
                type="text"
                class="size-7 p-0"
                :class="
                  kb.shareEnabled === 1
                    ? 'text-primary hover:text-primary/80'
                    : 'text-slate-400 hover:text-slate-600'
                "
                @click="onShare(kb, $event)"
              >
                <span class="i-lucide-share-2 size-3.5"></span>
              </Button>
            </Tooltip>
            <div class="hidden group-hover:flex items-center gap-1">
              <Tooltip :title="$t('common.edit')">
                <Button
                  v-access:code="['ai:knowledge:create']"
                  size="small"
                  type="text"
                  class="size-7 p-0 text-muted-foreground hover:text-foreground"
                  @click="onEdit(kb, $event)"
                >
                  <span class="i-lucide-pencil size-3.5"></span>
                </Button>
              </Tooltip>
              <Popconfirm
                :title="$t('page.ai.knowledge.confirmDeleteKb')"
                @confirm.stop="onDelete(kb)"
              >
                <Tooltip :title="$t('common.delete')">
                  <Button
                    size="small"
                    type="text"
                    danger
                    class="size-7 p-0"
                    @click.stop
                  >
                    <span class="i-lucide-trash-2 size-3.5"></span>
                  </Button>
                </Tooltip>
              </Popconfirm>
            </div>
          </div>

          <!-- 图标 + 名称 -->
          <div class="mb-3 flex items-center gap-3">
            <div
              :class="kbColor(kb)"
              class="flex size-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold"
            >
              {{ kbIcon(kb) }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold leading-tight">
                {{ kb.name }}
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ kb.docCount }}
                {{ $t('page.ai.knowledge.docCountSuffix') }}
              </p>
            </div>
          </div>

          <!-- 描述 -->
          <p
            class="mb-4 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground"
          >
            {{ kb.description || $t('page.ai.knowledge.noDescription') }}
          </p>

          <!-- 底部操作条 -->
          <div
            class="flex items-center justify-between border-t border-border pt-3"
          >
            <span class="text-xs text-muted-foreground">
              {{ kb.createTime?.slice(0, 10) }}
            </span>
            <Button
              size="small"
              type="link"
              class="h-auto p-0 text-xs"
              @click.stop="onManageDocs(kb)"
            >
              {{ $t('page.ai.knowledge.manageDocs') }} →
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Page>
</template>
