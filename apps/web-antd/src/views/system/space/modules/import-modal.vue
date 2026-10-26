<script lang="ts" setup>
import type { SpaceImportResult } from '#/api/system/space';

/**
 * 空间 CSV 导入对话框。
 *
 * <h2>为什么不做成「一键导入」</h2>
 *
 * 导入是**批量且不可轻易撤销**的操作（几百行空间），所以流程上必须让用户看到：
 * ① 模板格式（避免自己猜列名）；② 导入模式（insert 还是覆盖式 upsert）；
 * ③ 导入结果（哪几行错、错在哪）。
 *
 * 把这三件事塞进一个按钮，用户会在出错时完全不知道从哪查。
 */
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  Alert,
  Button,
  message,
  Radio,
  Space,
  Table,
  Tag,
  Upload,
} from 'ant-design-vue';

import { downloadSpaceImportTemplate, importSpaces } from '#/api/system/space';
import { $t } from '#/locales';
import { extractErrorMessage } from '#/utils/error';
import { downloadBlobSafe } from '#/utils/file';

const emit = defineEmits(['success']);

type ImportMode = 'insert' | 'upsert';

const mode = ref<ImportMode>('insert');
const selectedFile = ref<File>();
const submitting = ref(false);
const result = ref<SpaceImportResult>();

/** 是否已导入过（决定是否展示结果区） */
const hasResult = computed(() => !!result.value);

/** 是否全部成功 */
const allSucceeded = computed(() => {
  const current = result.value;
  // 不用非空断言：lint 禁止，且 `?.` 在这里语义完全等价（result 为空时整体为 false）
  return !!current && current.failed === 0;
});

/** 下载导入模板 */
async function onDownloadTemplate() {
  try {
    const blob = await downloadSpaceImportTemplate();
    // 用既有 downloadBlobSafe：它会识别「HTTP 200 但 body 是业务失败 JSON」，
    // 避免把错误体存成 .csv（用户拿到打不开的文件却不知道原因）
    await downloadBlobSafe(
      blob,
      'space-import-template.csv',
      $t('system.space.templateDownloadFailed'),
    );
  } catch (error: unknown) {
    message.error(
      extractErrorMessage(error, $t('system.space.templateDownloadFailed')),
    );
  }
}

/**
 * 选择文件（不自动上传）。
 *
 * **不自动上传**是刻意的：导入前用户要先选模式、确认模板对得上。
 * 选完即传会让「只想看一眼模板」的用户误触发一次真实导入。
 *
 * @param file 选中的文件
 * @returns 始终 false 以阻止组件自动上传
 */
function onBeforeUpload(file: File) {
  selectedFile.value = file;
  // 换文件后清掉上一次结果，避免「看着旧结果、改着新文件」
  result.value = undefined;
  return false;
}

/** 执行导入 */
async function onImport() {
  if (!selectedFile.value) {
    message.warning($t('system.space.pleaseSelectFile'));
    return;
  }
  submitting.value = true;
  try {
    result.value = await importSpaces(selectedFile.value, mode.value);
    if (result.value.failed === 0) {
      message.success(
        $t('system.space.importAllSucceeded', [
          result.value.inserted + result.value.updated,
        ]),
      );
      emit('success');
    } else {
      // 部分失败也要刷新列表：成功的那些行已经进库了
      emit('success');
    }
  } catch (error: any) {
    message.error(extractErrorMessage(error, $t('system.space.importFailed')));
  } finally {
    submitting.value = false;
  }
}

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen: boolean) {
    if (isOpen) {
      // 每次打开重置：残留的上次文件/结果会让人误以为已导入
      mode.value = 'insert';
      selectedFile.value = undefined;
      result.value = undefined;
    }
  },
  onConfirm() {
    // 用自定义按钮而不是默认「确定」：默认按钮语义不明确（是「导入」还是「关闭」）
    modalApi.close();
  },
});

defineExpose({ modalApi });
</script>

<template>
  <Modal
    :title="$t('system.space.importTitle')"
    class="w-[760px]"
    :footer="false"
  >
    <div class="flex flex-col gap-4">
      <!-- 步骤 1：模板 -->
      <div class="rounded border border-solid p-3">
        <div class="mb-1 text-sm font-medium">
          {{ $t('system.space.importStep1') }}
        </div>
        <div class="mb-2 text-xs text-gray-500">
          {{ $t('system.space.importTemplateHelp') }}
        </div>
        <Button @click="onDownloadTemplate">
          {{ $t('system.space.downloadTemplate') }}
        </Button>
      </div>

      <!-- 步骤 2：模式 + 文件 -->
      <div class="rounded border border-solid p-3">
        <div class="mb-2 text-sm font-medium">
          {{ $t('system.space.importStep2') }}
        </div>
        <div class="mb-2">
          <div class="mb-1 text-xs text-gray-500">
            {{ $t('system.space.importMode') }}
          </div>
          <Radio.Group v-model:value="mode">
            <Radio value="insert">
              {{ $t('system.space.importModeInsert') }}
            </Radio>
            <Radio value="upsert">
              {{ $t('system.space.importModeUpsert') }}
            </Radio>
          </Radio.Group>
          <div v-if="mode === 'upsert'" class="mt-1 text-xs text-orange-500">
            {{ $t('system.space.importModeUpsertWarning') }}
          </div>
        </div>
        <Upload
          accept=".csv"
          :before-upload="onBeforeUpload"
          :file-list="[]"
          :max-count="1"
        >
          <Button>{{ $t('system.space.selectCsvFile') }}</Button>
        </Upload>
        <div v-if="selectedFile" class="mt-2 text-xs text-gray-500">
          {{ $t('system.space.selectedFile') }}{{ selectedFile.name }}
        </div>
      </div>

      <!-- 步骤 3：执行 -->
      <Space>
        <Button
          :disabled="!selectedFile"
          :loading="submitting"
          type="primary"
          @click="onImport"
        >
          {{ $t('system.space.startImport') }}
        </Button>
        <Button @click="modalApi.close()">{{ $t('common.cancel') }}</Button>
      </Space>

      <!-- 结果 -->
      <div v-if="hasResult">
        <Alert
          v-if="allSucceeded"
          :message="
            $t('system.space.importAllSucceeded', [
              result!.inserted + result!.updated,
            ])
          "
          show-icon
          type="success"
        />
        <template v-else>
          <Alert
            :message="
              $t('system.space.importPartialFailed', [
                result!.inserted + result!.updated,
                result!.failed,
              ])
            "
            show-icon
            type="warning"
          />
          <!--
            截断时必须显式提示「仅显示前 N 条」：
            静默截断会让用户以为总共只错这么多，改完这几行又撞下一批。
          -->
          <div
            v-if="result!.errorTruncated"
            class="mt-2 text-xs text-orange-500"
          >
            {{
              $t('system.space.importErrorTruncated', [result!.errors.length])
            }}
          </div>
          <Table
            :columns="[
              {
                dataIndex: 'lineNo',
                title: $t('system.space.csvLineNo'),
                width: 90,
              },
              { dataIndex: 'code', title: $t('system.space.code'), width: 140 },
              {
                dataIndex: 'message',
                title: $t('system.space.importErrorReason'),
              },
            ]"
            :data-source="result!.errors"
            :pagination="false"
            class="mt-2"
            row-key="lineNo"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'lineNo'">
                <Tag color="red">{{ record.lineNo }}</Tag>
              </template>
            </template>
          </Table>
        </template>
      </div>
    </div>
  </Modal>
</template>
