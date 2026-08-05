<script lang="ts" setup>
import { computed } from 'vue';

import { Modal } from 'ant-design-vue';

import { $t } from '#/locales';

import { sanitizeHtml } from './sanitize';

/**
 * 通用富文本详情弹窗：props.data 传内容、open 控制显隐、update:open 通知关闭。
 * 显式 props/emit 受控，不依赖 defineModel，布局与页面均可直接使用。
 */
const props = defineProps<{
  data?: { content?: string; createTime?: string; title?: string };
  open?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
}>();

const title = computed(() => props.data?.title || $t('system.message.msgTitle'));

function onOpenChange(open: boolean) {
  emit('update:open', open);
}
</script>
<template>
  <Modal
    :open="open"
    :title="title"
    :footer="null"
    :width="800"
    @update:open="onOpenChange"
  >
    <div class="p-4">
      <div
        v-if="data?.createTime"
        class="text-foreground/50 mb-3 text-center text-sm"
      >
        {{ data.createTime }}
      </div>
      <!-- 站内信/公告正文为后端存储的富文本 HTML，渲染前经 DOMPurify 净化防 XSS -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="tiptap-preview" v-html="sanitizeHtml(data?.content)"></div>
    </div>
  </Modal>
</template>
