<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Steps,
  Switch,
  Upload,
} from 'ant-design-vue';

import {
  batchUploadDocuments,
  createKnowledgeBase,
  getModelList,
  importDocumentFromUrl,
  queryKnowledgeBaseWithSources,
  setShareSetting,
} from '#/api/ai';
import { $t } from '#/locales';

const emits = defineEmits<{
  openDocs: [kb: AiApi.KnowledgeBase];
  reload: [];
}>();

const open = ref(false);
const current = ref(0);
const busy = ref(false);

// ---- Step1 基本信息 ----
const form = ref<AiApi.KnowledgeBaseSaveReq>({
  name: '',
  description: '',
  icon: 'lucide:book-open',
});
const iconOptions = [
  { icon: 'lucide:book-open', value: 'lucide:book-open' },
  { icon: 'lucide:rocket', value: 'lucide:rocket' },
  { icon: 'lucide:lightbulb', value: 'lucide:lightbulb' },
  { icon: 'lucide:brain', value: 'lucide:brain' },
  { icon: 'lucide:wrench', value: 'lucide:wrench' },
  { icon: 'lucide:file-text', value: 'lucide:file-text' },
  { icon: 'lucide:globe', value: 'lucide:globe' },
  { icon: 'lucide:database', value: 'lucide:database' },
];

// ---- Step2 选择模型 ----
const chatModels = ref<AiApi.ModelConfig[]>([]);
const embedModels = ref<AiApi.ModelConfig[]>([]);
const modelsLoading = ref(false);

// ---- Step3 导入文档 ----
const importType = ref<'FILE' | 'URL'>('FILE');
const importSource = ref<AiApi.KbImportReq['sourceType']>('URL');
const files = ref<File[]>([]);
const importUrl = ref('');
const importing = ref(false);

// ---- Step4 检索配置 ----
const retrievalConfig = ref({
  similarityThreshold: 0.5,
  topK: 5,
  chunkSize: 1000,
});

// ---- Step5 测试问答 ----
const testQuestion = ref('');
const testResult = ref<AiApi.KbQueryResult | null>(null);
const testing = ref(false);

// ---- Step6 分享设置 ----
const shareEnabled = ref(false);
const sharePassword = ref('');

// 已创建的知识库
const createdKb = ref<AiApi.KnowledgeBase | null>(null);

const steps = computed(() => [
  { title: $t('page.ai.wizard.stepBasic') },
  { title: $t('page.ai.wizard.stepModel') },
  { title: $t('page.ai.wizard.stepImport') },
  { title: $t('page.ai.wizard.stepConfig') },
  { title: $t('page.ai.wizard.stepTest') },
  { title: $t('page.ai.wizard.stepShare') },
  { title: $t('page.ai.wizard.stepDone') },
]);

const isLast = computed(() => current.value === steps.value.length - 1);

async function loadModels() {
  modelsLoading.value = true;
  try {
    const [chat, embed] = await Promise.all([
      getModelList('CHAT'),
      getModelList('EMBEDDING'),
    ]);
    chatModels.value = chat;
    embedModels.value = embed;
  } finally {
    modelsLoading.value = false;
  }
}

function openWizard() {
  current.value = 0;
  createdKb.value = null;
  form.value = { name: '', description: '', icon: 'lucide:book-open' };
  files.value = [];
  importUrl.value = '';
  importType.value = 'FILE';
  testQuestion.value = '';
  testResult.value = null;
  shareEnabled.value = false;
  sharePassword.value = '';
  open.value = true;
  loadModels();
}

async function createKb() {
  if (createdKb.value) return;
  busy.value = true;
  try {
    createdKb.value = await createKnowledgeBase({
      name: form.value.name.trim(),
      description: form.value.description?.trim() || undefined,
      icon: form.value.icon || 'lucide:book-open',
    });
    message.success($t('common.success'));
  } finally {
    busy.value = false;
  }
}

async function doImport() {
  if (!createdKb.value) return;
  importing.value = true;
  try {
    if (importType.value === 'FILE' && files.value.length > 0) {
      await batchUploadDocuments(createdKb.value.id, files.value);
    } else if (
      importType.value === 'URL' &&
      importUrl.value.trim() &&
      createdKb.value
    ) {
      await importDocumentFromUrl(createdKb.value.id, {
        sourceType: importSource.value,
        url: importUrl.value.trim(),
      });
    }
    message.success($t('page.ai.wizard.importSuccess'));
  } catch (error: any) {
    message.error(error?.message || $t('common.requestFailed'));
  } finally {
    importing.value = false;
  }
}

async function doTest() {
  if (!createdKb.value || !testQuestion.value.trim()) return;
  testing.value = true;
  try {
    testResult.value = await queryKnowledgeBaseWithSources(
      createdKb.value.id,
      testQuestion.value,
    );
  } catch (error: any) {
    message.error(error?.message || $t('common.requestFailed'));
  } finally {
    testing.value = false;
  }
}

async function saveShare() {
  if (!createdKb.value) return;
  busy.value = true;
  try {
    if (shareEnabled.value) {
      await setShareSetting(createdKb.value.id, {
        enabled: true,
        password: sharePassword.value.trim() || undefined,
      });
    }
  } finally {
    busy.value = false;
  }
}

function onBeforeUpload(file: File) {
  if (files.value.length >= 20) {
    message.warning($t('page.ai.wizard.uploadTip'));
    return false;
  }
  files.value.push(file);
  return false;
}

async function onNext() {
  if (current.value === 0) {
    if (!form.value.name?.trim()) {
      message.error($t('page.ai.wizard.nameRequired'));
      return;
    }
  }
  if (current.value === 1) {
    await createKb();
  }
  if (current.value === 2) {
    if (importType.value === 'URL' && importUrl.value.trim()) {
      await doImport();
    }
  }
  if (current.value === 5) {
    await saveShare();
  }
  current.value += 1;
}

function onFinish() {
  emits('reload');
  open.value = false;
}

function onGoDocs() {
  if (!createdKb.value) return;
  emits('reload');
  emits('openDocs', createdKb.value);
  open.value = false;
}

function onClose() {
  if (createdKb.value) emits('reload');
  open.value = false;
}

defineExpose({ openWizard });

watch(open, (v) => {
  if (!v && createdKb.value) emits('reload');
});
</script>

<template>
  <Modal
    :open="open"
    :title="$t('page.ai.wizard.title')"
    :width="760"
    :footer="null"
    :mask-closable="false"
    destroy-on-close
    @cancel="onClose"
  >
    <div class="py-2">
      <Steps :current="current" :items="steps" size="small" class="mb-6" />

      <div class="max-h-[58vh] overflow-y-auto pr-1">
        <!-- Step1 基本信息 -->
        <div v-if="current === 0" class="fade-step space-y-4">
          <div>
            <p class="mb-1.5 text-sm font-medium">
              {{ $t('page.ai.wizard.name') }}
            </p>
            <Input
              v-model:value="form.name"
              :placeholder="$t('page.ai.wizard.namePlaceholder')"
              :maxlength="50"
            />
          </div>
          <div>
            <p class="mb-1.5 text-sm font-medium">
              {{ $t('page.ai.wizard.icon') }}
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="e in iconOptions"
                :key="e.value"
                type="button"
                class="flex size-9 items-center justify-center rounded-lg border text-lg transition-colors"
                :class="
                  form.icon === e.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent'
                "
                @click="form.icon = e.value"
              >
                <IconifyIcon :icon="e.icon" class="size-5" />
              </button>
              <Input
                v-model:value="form.icon"
                :maxlength="24"
                class="w-24"
                :placeholder="$t('page.ai.wizard.iconPlaceholder')"
              />
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ $t('page.ai.wizard.iconHint') }}
            </p>
          </div>
          <div>
            <p class="mb-1.5 text-sm font-medium">
              {{ $t('page.ai.wizard.description') }}
            </p>
            <Input.TextArea
              v-model:value="form.description"
              :placeholder="$t('page.ai.wizard.descPlaceholder')"
              :rows="3"
              :maxlength="300"
            />
          </div>
        </div>

        <!-- Step2 选择模型 -->
        <div v-if="current === 1" class="fade-step space-y-5">
          <p class="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            {{ $t('page.ai.wizard.modelHint') }}
          </p>
          <div>
            <p class="mb-2 text-sm font-medium">
              {{ $t('page.ai.wizard.chatModel') }}
            </p>
            <div v-if="chatModels.length" class="flex flex-wrap gap-2">
              <span
                v-for="m in chatModels"
                :key="m.id"
                class="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs"
                :class="m.isDefault === 1 ? 'border-primary text-primary' : ''"
              >
                <span class="i-lucide-message-circle size-3.5"></span>
                {{ m.name }} · {{ m.modelName }}
                <span
                  v-if="m.isDefault === 1"
                  class="rounded bg-primary/10 px-1 text-[10px] text-primary"
                  >{{ $t('page.ai.wizard.defaultTag') }}</span>
              </span>
            </div>
            <p v-else class="text-sm text-destructive">
              {{ $t('page.ai.wizard.noChatModel') }}
            </p>
          </div>
          <div>
            <p class="mb-2 text-sm font-medium">
              {{ $t('page.ai.wizard.embedModel') }}
            </p>
            <div v-if="embedModels.length" class="flex flex-wrap gap-2">
              <span
                v-for="m in embedModels"
                :key="m.id"
                class="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs"
                :class="m.isDefault === 1 ? 'border-primary text-primary' : ''"
              >
                <span class="i-lucide-vector-square size-3.5"></span>
                {{ m.name }} · {{ m.modelName }}
                <span
                  v-if="m.isDefault === 1"
                  class="rounded bg-primary/10 px-1 text-[10px] text-primary"
                  >{{ $t('page.ai.wizard.defaultTag') }}</span>
              </span>
            </div>
            <p v-else class="text-sm text-destructive">
              {{ $t('page.ai.wizard.noEmbedModel') }}
            </p>
          </div>
        </div>

        <!-- Step3 导入文档 -->
        <div v-if="current === 2" class="fade-step space-y-4">
          <p class="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            {{ $t('page.ai.wizard.importHint') }}
          </p>
          <div class="flex gap-2">
            <Button
              size="small"
              :type="importType === 'FILE' ? 'primary' : 'default'"
              @click="importType = 'FILE'"
            >
              {{ $t('page.ai.wizard.importTypeFile') }}
            </Button>
            <Button
              size="small"
              :type="importType === 'URL' ? 'primary' : 'default'"
              @click="importType = 'URL'"
            >
              {{ $t('page.ai.wizard.importTypeUrl') }}
            </Button>
          </div>

          <template v-if="importType === 'FILE'">
            <Upload
              :multiple="true"
              :show-upload-list="false"
              :before-upload="onBeforeUpload"
            >
              <Button :loading="importing" :disabled="files.length >= 20">
                {{ $t('page.ai.wizard.uploadBtn') }}
              </Button>
            </Upload>
            <p class="text-xs text-muted-foreground">
              {{ $t('page.ai.wizard.uploadTip') }}
            </p>
            <div v-if="files.length" class="flex flex-col gap-1.5">
              <div
                v-for="(f, i) in files"
                :key="`${f.name}-${i}`"
                class="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
              >
                <span
                  class="i-lucide-file-text size-3.5 shrink-0 opacity-60"
                ></span>
                <span class="flex-1 truncate">{{ f.name }}</span>
                <button
                  type="button"
                  class="text-muted-foreground hover:text-destructive"
                  @click="files.splice(i, 1)"
                >
                  <span class="i-lucide-x size-3.5"></span>
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="flex gap-2">
              <Select
                v-model:value="importSource"
                class="w-32"
                :options="[
                  { value: 'URL', label: $t('page.ai.wizard.importSourceUrl') },
                  {
                    value: 'SITEMAP',
                    label: $t('page.ai.wizard.importSourceSitemap'),
                  },
                  { value: 'RSS', label: $t('page.ai.wizard.importSourceRss') },
                ]"
              />
              <Input
                v-model:value="importUrl"
                :placeholder="$t('page.ai.wizard.importUrlPlaceholder')"
              />
              <Button
                type="primary"
                :loading="importing"
                :disabled="!importUrl.trim()"
                @click="doImport"
              >
                {{ $t('page.ai.wizard.importStart') }}
              </Button>
            </div>
          </template>
        </div>

        <!-- Step4 检索配置 -->
        <div v-if="current === 3" class="fade-step space-y-4">
          <p class="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            {{ $t('page.ai.wizard.configHint') }}
          </p>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="rounded-lg border border-border p-4">
              <p class="mb-2 text-xs text-muted-foreground">
                {{ $t('page.ai.wizard.similarityThreshold') }}
              </p>
              <InputNumber
                :model-value="retrievalConfig.similarityThreshold"
                :min="0"
                :max="1"
                :step="0.1"
                disabled
                class="w-full"
              />
            </div>
            <div class="rounded-lg border border-border p-4">
              <p class="mb-2 text-xs text-muted-foreground">
                {{ $t('page.ai.wizard.topK') }}
              </p>
              <InputNumber
                :model-value="retrievalConfig.topK"
                :min="1"
                :max="20"
                :step="1"
                disabled
                class="w-full"
              />
            </div>
            <div class="rounded-lg border border-border p-4">
              <p class="mb-2 text-xs text-muted-foreground">
                {{ $t('page.ai.wizard.chunkSize') }}
              </p>
              <InputNumber
                :model-value="retrievalConfig.chunkSize"
                :min="100"
                :max="5000"
                :step="100"
                disabled
                class="w-full"
              />
            </div>
          </div>
        </div>

        <!-- Step5 测试问答 -->
        <div v-if="current === 4" class="fade-step space-y-4">
          <p class="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            {{ $t('page.ai.wizard.testHint') }}
          </p>
          <div class="flex gap-2">
            <Input
              v-model:value="testQuestion"
              :placeholder="$t('page.ai.wizard.testPlaceholder')"
              @keydown.enter="doTest"
            />
            <Button type="primary" :loading="testing" @click="doTest">
              {{ $t('page.ai.wizard.testBtn') }}
            </Button>
          </div>
          <div
            v-if="testResult"
            class="space-y-3 rounded-lg border border-border p-4"
          >
            <div>
              <p class="mb-1 text-xs font-semibold text-primary">AI</p>
              <p class="whitespace-pre-wrap text-sm leading-relaxed">
                {{ testResult.answer }}
              </p>
            </div>
            <div
              v-if="testResult.sources?.length"
              class="border-t border-border pt-3"
            >
              <p class="mb-1.5 text-xs font-semibold">
                {{ $t('page.ai.wizard.sourcesLabel') }}
              </p>
              <div class="flex flex-col gap-1.5">
                <div
                  v-for="(s, i) in testResult.sources"
                  :key="i"
                  class="rounded bg-muted/40 p-2 text-xs"
                >
                  <p class="line-clamp-3 text-muted-foreground">
                    {{ s.content }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-muted-foreground">
            {{ $t('page.ai.wizard.testNoResult') }}
          </p>
        </div>

        <!-- Step6 分享设置 -->
        <div v-if="current === 5" class="fade-step space-y-4">
          <p class="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            {{ $t('page.ai.wizard.shareHint') }}
          </p>
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">
              {{ $t('page.ai.wizard.shareEnable') }}
            </span>
            <Switch v-model:checked="shareEnabled" />
          </div>
          <div v-if="shareEnabled">
            <p class="mb-1.5 text-sm font-medium">
              {{ $t('page.ai.wizard.accessPassword') }}
            </p>
            <Input.Password
              v-model:value="sharePassword"
              :placeholder="$t('page.ai.wizard.sharePasswordPlaceholder')"
              allow-clear
            />
          </div>
        </div>

        <!-- Step7 完成 -->
        <div
          v-if="current === 6"
          class="fade-step flex flex-col items-center gap-3 py-8"
        >
          <span
            class="flex size-16 items-center justify-center rounded-full bg-emerald-500/10"
          >
            <IconifyIcon
              icon="lucide:check-circle"
              class="size-10 text-emerald-500"
            />
          </span>
          <p class="text-base font-semibold">
            <IconifyIcon
              v-if="createdKb?.icon"
              :icon="createdKb.icon ?? ''"
              class="mr-1 inline size-5"
            />
            {{ createdKb?.name }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ $t('page.ai.wizard.doneDesc') }}
          </p>
        </div>
      </div>

      <!-- 底部操作 -->
      <div
        class="mt-6 flex items-center justify-between border-t border-border pt-4"
      >
        <Button v-if="current > 0 && current < 6" @click="current -= 1">
          {{ $t('page.ai.wizard.prev') }}
        </Button>
        <span v-else></span>

        <div class="flex gap-2">
          <Button
            v-if="current === 2 && importType === 'URL'"
            @click="current += 1"
          >
            {{ $t('page.ai.wizard.skipImport') }}
          </Button>
          <Button v-if="!isLast" type="primary" :loading="busy" @click="onNext">
            {{ $t('page.ai.wizard.next') }}
          </Button>
          <template v-else>
            <Button @click="onGoDocs">{{ $t('page.ai.wizard.goDocs') }}</Button>
            <Button type="primary" @click="onFinish">
              {{ $t('page.ai.wizard.finish') }}
            </Button>
          </template>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
/* 步骤面板切换淡入微动效 */
.fade-step {
  animation: fade-step 0.25s ease-out;
}

@keyframes fade-step {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}
</style>
