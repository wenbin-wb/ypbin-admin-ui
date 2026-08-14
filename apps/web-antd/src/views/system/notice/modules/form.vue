<script lang="ts" setup>
import type { SystemNoticeApi } from '#/api/system/notice';

import { computed, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { VbenTiptap } from '@vben/plugins/tiptap';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createNotice, updateNotice } from '#/api/system/notice';
import { $t } from '#/locales';

import ImageUpload from '../../_shared/image-upload.vue';
import { useFormSchema } from '../data';

const emit = defineEmits(['reload']);
const { hasAccessByCodes } = useAccess();
const isUpdate = ref(false);
const canUploadCover = computed(
  () =>
    hasAccessByCodes(['system:file:upload']) &&
    hasAccessByCodes([
      isUpdate.value ? 'system:notice:edit' : 'system:notice:add',
    ]),
);
const rowId = ref('');

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

/**
 * 富文本内容变化时写回表单 content 字段。
 * VbenTiptap 的 modelValue 双向绑定在弹层表单中偶发不同步，这里用其 change 事件
 * 显式将 HTML 写回 formApi，确保提交时 content 一定带上。
 */
function onContentChange(payload: { html: string }) {
  formApi.setFieldValue('content', payload.html);
}

/** 提交：draft=true 存为草稿（publishStatus=0） */
async function submit(draft: boolean) {
  const { valid } = await formApi.validate();
  if (!valid) {
    return;
  }
  const values = await formApi.getValues<{
    content: string;
    cover?: string;
    effectiveTime?: string;
    expireTime?: string;
    isTop?: number;
    noticeScope?: number;
    noticeType: number;
    notifyMethods: string[];
    publishType?: number;
    scheduledTime?: string;
    scopeTargetIds?: string;
    title: string;
  }>();
  const data: SystemNoticeApi.NoticeSaveReq = {
    content: values.content,
    cover: values.cover,
    effectiveTime: values.effectiveTime,
    expireTime: values.expireTime,
    isTop: values.isTop,
    noticeScope: values.noticeScope,
    noticeType: values.noticeType,
    notifyMethods: values.notifyMethods.join(','),
    publishStatus: draft ? 0 : undefined,
    publishType: values.publishType,
    scheduledTime: values.scheduledTime,
    scopeTargetIds: values.scopeTargetIds,
    title: values.title,
  };
  try {
    modalApi.setState({ confirmLoading: true });
    await (isUpdate.value
      ? updateNotice(rowId.value, data)
      : createNotice(data));
    message.success($t('common.success'));
    modalApi.close();
    emit('reload');
  } finally {
    modalApi.setState({ confirmLoading: false });
  }
}

type NoticeFormData = null | SystemNoticeApi.NoticeResp;

const [Modal, modalApi] = useVbenModal<NoticeFormData>({
  onCancel() {
    modalApi.close();
  },
  onConfirm() {
    submit(false);
  },
  async onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = modalApi.getData();
      isUpdate.value = !!data?.id;
      rowId.value = data?.id ?? '';
      formApi.reset();
      modalApi.setState({
        title: isUpdate.value
          ? $t('ui.actionTitle.edit', [$t('system.notice.title')])
          : $t('ui.actionTitle.create', [$t('system.notice.title')]),
      });
      await nextTick();
      if (data) {
        formApi.setValues({
          ...data,
          notifyMethods: data.notifyMethods
            ? data.notifyMethods.split(',')
            : [],
        });
      }
    }
  },
});

defineExpose({ modalApi });
</script>
<template>
  <Modal class="w-[1000px]">
    <Form class="mx-4">
      <template #cover="slotProps">
        <ImageUpload
          v-if="canUploadCover"
          v-bind="slotProps.componentField"
          module="notice"
          aspect-ratio="16:9"
        />
      </template>
      <!-- 富文本内容：显式绑定 change 事件写回 content，避免提交时内容丢失 -->
      <template #content="{ componentField, modelValue }">
        <VbenTiptap
          v-bind="componentField"
          :model-value="modelValue"
          :placeholder="$t('system.notice.contentPlaceholder')"
          @change="onContentChange"
        />
      </template>
    </Form>
    <template #prepend-footer>
      <div class="flex-auto">
        <Button @click="submit(true)">
          {{ $t('system.notice.saveDraft') }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
