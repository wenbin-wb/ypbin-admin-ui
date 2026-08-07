<script lang="ts" setup>
import type { SystemNoticeApi } from '#/api/system/notice';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { $t } from '#/locales';

import { sanitizeHtml } from '../../_shared/sanitize';

const title = ref('');
const content = ref('');
const publishTime = ref('');

const [Modal, modalApi] = useVbenModal<SystemNoticeApi.NoticeResp>({
  footer: false,
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = modalApi.getData();
      title.value = data?.title ?? '';
      content.value = data?.content ?? '';
      publishTime.value = data?.publishTime ?? '';
    }
  },
});

defineExpose({ modalApi });
</script>
<template>
  <Modal :title="$t('system.notice.preview')" class="w-[800px]">
    <div class="p-4">
      <h2 class="mb-2 text-center text-lg font-medium">{{ title }}</h2>
      <div v-if="publishTime" class="mb-4 text-center text-sm text-gray-400">
        {{ publishTime }}
      </div>
      <!-- 内容为后端存储的富文本 HTML，渲染前经 DOMPurify 净化防 XSS -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="tiptap-preview" v-html="sanitizeHtml(content)"></div>
    </div>
  </Modal>
</template>
