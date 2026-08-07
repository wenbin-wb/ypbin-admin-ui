<script lang="ts" setup>
import type { SystemNoticeApi } from '#/api/system/notice';

import { nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createNotice, updateNotice } from '#/api/system/notice';
import { $t } from '#/locales';

import ImageUpload from '../../_shared/image-upload.vue';
import { useFormSchema } from '../data';

const emit = defineEmits(['reload']);
const isUpdate = ref(false);
const rowId = ref('');

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

/** 提交：draft=true 存为草稿（publishStatus=0） */
async function submit(draft: boolean) {
  const { valid } = await formApi.validate();
  if (!valid) {
    return;
  }
  const values = await formApi.getValues();
  // notifyMethods 表单为数组，后端存逗号分隔字符串
  if (Array.isArray(values.notifyMethods)) {
    values.notifyMethods = values.notifyMethods.join(',');
  }
  if (draft) {
    values.publishStatus = 0;
  }
  try {
    modalApi.setState({ confirmLoading: true });
    await (isUpdate.value
      ? updateNotice(rowId.value, values)
      : createNotice(values));
    message.success($t('common.success'));
    modalApi.close();
    emit('reload');
  } finally {
    modalApi.setState({ confirmLoading: false });
  }
}

type NoticeFormData =
  | { isUpdate: false }
  | { isUpdate: true; row: SystemNoticeApi.NoticeResp };

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
      isUpdate.value = !!data?.isUpdate;
      modalApi.setState({
        title: isUpdate.value
          ? $t('ui.actionTitle.edit', [$t('system.notice.title')])
          : $t('ui.actionTitle.create', [$t('system.notice.title')]),
      });
      // 等表单实例挂载就绪再回填/重置，否则重开时 setValues 早于表单初始化会失效
      await nextTick();
      if (data?.isUpdate) {
        rowId.value = data.row.id;
        // 逗号分隔字符串还原为数组供多选组件使用
        formApi.setValues({
          ...data.row,
          notifyMethods: data.row.notifyMethods
            ? data.row.notifyMethods.split(',')
            : [],
        });
      } else {
        rowId.value = '';
        formApi.reset();
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
          v-bind="slotProps.componentField"
          module="notice"
          aspect-ratio="16:9"
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
