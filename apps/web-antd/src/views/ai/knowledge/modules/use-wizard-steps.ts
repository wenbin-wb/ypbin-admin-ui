import type { AiApi } from '#/api/ai';

import { computed, ref, watch } from 'vue';

import { message } from 'ant-design-vue';

import {
  batchUploadDocuments,
  createKnowledgeBase,
  getModelList,
  importDocumentFromUrl,
  queryKnowledgeBaseWithSources,
  setShareSetting,
} from '#/api/ai';
import { $t } from '#/locales';
import { extractErrorMessage } from '#/utils/error';

/**
 * 知识库创建向导引擎：六步状态机（基本信息 → 选模型 → 导入 → 检索配置 →
 * 测试问答 → 分享），每步的落库动作与推进校验都收敛在此。
 *
 * 组件只负责步骤内容的呈现；关闭/完成/去文档页通过回调通知调用方。
 */
export function useWizardSteps(deps: {
  onCloseNoCreate: () => void;
  onOpenDocs: (kb: AiApi.KnowledgeBase) => void;
  onReload: () => void;
}) {
  const open = ref(false);
  const current = ref(0);
  const busy = ref(false);

  // ---- Step1 基本信息 ----
  const form = ref<AiApi.KnowledgeBaseSaveReq>({
    name: '',
    description: '',
    icon: 'lucide:book-open',
  });

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
    } catch (error) {
      message.error(extractErrorMessage(error, $t('common.requestFailed')));
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
    } catch (error) {
      message.error(extractErrorMessage(error, $t('common.requestFailed')));
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
    if (current.value === 0 && !form.value.name?.trim()) {
      message.error($t('page.ai.wizard.nameRequired'));
      return;
    }
    if (current.value === 1) {
      await createKb();
    }
    if (
      current.value === 2 &&
      importType.value === 'URL' &&
      importUrl.value.trim()
    ) {
      await doImport();
    }
    if (current.value === 5) {
      await saveShare();
    }
    current.value += 1;
  }

  function onFinish() {
    deps.onReload();
    open.value = false;
  }

  function onGoDocs() {
    if (!createdKb.value) return;
    deps.onReload();
    deps.onOpenDocs(createdKb.value);
    open.value = false;
  }

  function onClose() {
    if (createdKb.value) deps.onReload();
    else deps.onCloseNoCreate();
    open.value = false;
  }

  watch(open, (v) => {
    if (!v && createdKb.value) deps.onReload();
  });

  return {
    busy,
    chatModels,
    createdKb,
    current,
    doImport,
    doTest,
    embedModels,
    files,
    form,
    importSource,
    importType,
    importUrl,
    importing,
    isLast,
    modelsLoading,
    onBeforeUpload,
    onClose,
    onGoDocs,
    onNext,
    onFinish,
    open,
    openWizard,
    retrievalConfig,
    shareEnabled,
    sharePassword,
    steps,
    testQuestion,
    testResult,
    testing,
  };
}
