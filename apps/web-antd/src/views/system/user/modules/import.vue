<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { createIconifyIcon, Download } from '@vben/icons';

import { Alert, Button, message, Upload } from 'ant-design-vue';

import { downloadImportTemplate, importUsers } from '#/api/system/user';
import { $t } from '#/locales';
import { downloadByBlob } from '#/utils/file';

const emit = defineEmits(['success']);

const InboxIcon = createIconifyIcon('lucide:inbox');

const uploading = ref(false);
const downloadLoading = ref(false);
const failDetails = ref<Array<{ errorMsg: string; rowNum: number }>>([]);

const [Modal, modalApi] = useVbenModal({
  title: $t('system.user.importTitle'),
  footer: false,
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      failDetails.value = [];
      uploading.value = false;
    }
  },
});

/** 下载导入模板 */
async function onDownloadTemplate() {
  downloadLoading.value = true;
  try {
    const blob = await downloadImportTemplate();
    downloadByBlob(
      blob as Blob,
      $t('system.user.importTemplateFileName') || '用户导入模板.xlsx',
    );
    message.success($t('common.success'));
  } catch {
    message.error(
      $t('system.user.templateDownloadFailed') ||
        $t('system.user.exportFailed'),
    );
  } finally {
    downloadLoading.value = false;
  }
}

/** 上传并导入文件 */
async function handleImport(file: File) {
  uploading.value = true;
  failDetails.value = [];
  try {
    const result: any = await importUsers(file);
    const { successCount = 0, failCount = 0, failList = [] } = result ?? {};
    if (failCount > 0) {
      failDetails.value = failList;
      message.warning(
        $t('system.user.importResult', [successCount, failCount, '']) ||
          `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      );
    } else {
      message.success(
        $t('system.user.importSuccessCount', [successCount]) ||
          `导入成功 ${successCount} 条`,
      );
      modalApi.close();
    }
    emit('success');
  } catch {
    message.error($t('system.user.importFailed') || '导入失败');
  } finally {
    uploading.value = false;
  }
  return false;
}

defineExpose({ modalApi });
</script>

<template>
  <Modal>
    <div class="space-y-4 p-2">
      <!-- 模板下载提示区域 -->
      <div
        class="flex items-center justify-between rounded-md bg-slate-50 p-3 dark:bg-slate-800"
      >
        <span class="text-xs text-gray-500 dark:text-gray-400">
          {{ $t('system.user.importHint') }}
        </span>
        <Button
          :loading="downloadLoading"
          size="small"
          type="link"
          @click="onDownloadTemplate"
        >
          <template #icon>
            <Download class="size-4" />
          </template>
          {{ $t('system.user.importDownloadTemplate') }}
        </Button>
      </div>

      <!-- 文件上传区域 -->
      <Upload.Dragger
        :before-upload="handleImport"
        :disabled="uploading"
        :show-upload-list="false"
        accept=".xlsx,.xls"
      >
        <div class="py-6 text-center">
          <InboxIcon class="mx-auto mb-2 size-10 text-primary" />
          <p class="text-sm font-medium">
            {{
              uploading
                ? $t('ui.placeholder.loading')
                : $t('system.user.importChooseFile')
            }}
          </p>
          <p class="mt-1 text-xs text-gray-400">
            {{ $t('system.user.importHint') }}
          </p>
        </div>
      </Upload.Dragger>

      <!-- 错误明细提示 -->
      <div v-if="failDetails.length > 0" class="mt-3">
        <Alert banner show-icon type="error">
          <template #message>
            <span class="font-semibold">{{ $t('system.user.importFailed') }} ({{
                failDetails.length
              }})</span>
          </template>
          <template #description>
            <ul class="max-h-32 overflow-y-auto pl-4 text-xs">
              <li v-for="(item, idx) in failDetails" :key="idx">
                {{
                  $t('system.user.importRowError', [
                    item.rowNum,
                    item.errorMsg,
                  ]) || `第 ${item.rowNum} 行: ${item.errorMsg}`
                }}
              </li>
            </ul>
          </template>
        </Alert>
      </div>
    </div>
  </Modal>
</template>
