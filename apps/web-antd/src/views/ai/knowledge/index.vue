<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { onMounted, ref } from 'vue';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { IconifyIcon, Plus } from '@vben/icons';

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

import { deleteKnowledgeBase } from '#/api/ai';
import { $t } from '#/locales';

import CreateWizard from './modules/create-wizard.vue';
import Documents from './modules/documents.vue';
import Form from './modules/form.vue';
import { useKbShare } from './use-kb-share';
import { useKbWidget } from './use-kb-widget';
import { useKnowledgeBaseList } from './use-knowledge-base-list';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [DocumentsModal, documentsModalApi] = useVbenModal({
  connectedComponent: Documents,
  destroyOnClose: false,
});

const createWizardRef = ref<InstanceType<typeof CreateWizard>>();

// 列表域（加载/过滤/卡片展示辅助）
const {
  filteredKbs,
  isIconifyIcon,
  kbColor,
  kbIcon,
  keyword,
  knowledgeBases,
  loadKbs,
  loading,
} = useKnowledgeBaseList();

// 网页挂件弹窗域
const {
  onCopyCode,
  onWidget,
  onWidgetDisable,
  onWidgetEnable,
  widgetEmbedCode,
  widgetKb,
  widgetLoading,
  widgetOpen,
  widgetToken,
} = useKbWidget();

// 公开分享弹窗域
const {
  onCopyShareLink,
  onShare,
  onShareDisable,
  onShareEnable,
  onShareSave,
  shareEnabled,
  shareExpire,
  shareKb,
  shareLink,
  shareOpen,
  sharePassword,
  shareSaving,
  shareToken,
} = useKbShare();

function onCreate() {
  createWizardRef.value?.openWizard();
}

function onOpenDocsFromWizard(kb: AiApi.KnowledgeBase) {
  documentsModalApi.setData(kb).open();
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

onMounted(loadKbs);
</script>

<template>
  <Page auto-content-height content-class="p-4">
    <FormDrawer @reload="loadKbs" />
    <DocumentsModal @reload="loadKbs" />
    <CreateWizard
      ref="createWizardRef"
      @reload="loadKbs"
      @open-docs="onOpenDocsFromWizard"
    />

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
            <Button danger :loading="shareSaving" @click="onShareDisable">
              {{ $t('page.ai.knowledge.shareDisable') }}
            </Button>
            <Button :loading="shareSaving" type="primary" @click="onShareSave">
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
          <span class="text-sm text-muted-foreground">{{
            $t('page.ai.knowledge.countSuffix', [knowledgeBases.length])
          }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Input
            v-model:value="keyword"
            :placeholder="$t('page.ai.knowledge.searchPlaceholder')"
            allow-clear
            class="w-full sm:w-44"
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
              <IconifyIcon
                v-if="isIconifyIcon(kb.icon)"
                :icon="kb.icon ?? ''"
                class="size-5"
              />
              <template v-else>{{ kbIcon(kb) }}</template>
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
