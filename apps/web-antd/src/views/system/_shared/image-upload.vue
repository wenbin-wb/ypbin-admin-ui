<script lang="ts" setup>
import type { SystemCommonApi } from '#/api/system/common';

import { ref } from 'vue';

import { useVbenModal, VCropper } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { message } from 'ant-design-vue';

import { uploadFile } from '#/api/system/common';
import { $t } from '#/locales';

/**
 * 单图上传：v-model 绑定图片 URL 字符串。
 * 选图后用 vben 内置 VCropper 裁剪，裁剪结果上传后端并回填 url。
 * 用于封面、头像等场景。
 */
const props = withDefaults(
  defineProps<{
    /** 裁剪比例，如 '16:9'、'1:1'；不传则自由裁剪 */
    aspectRatio?: string;
    /** 图片大小限制（MB） */
    maxSize?: number;
    /** 业务模块目录 */
    module?: string;
    /** 形状：square 方形（封面）/ circle 圆形（头像，点图即上传） */
    shape?: 'circle' | 'square';
    /** 预览框尺寸（px） */
    size?: number;
    /** 上传函数：默认走平台文件上传，个人头像等场景传入各自的上传接口 */
    upload?: (file: File, module: string) => Promise<SystemCommonApi.FileInfo>;
  }>(),
  {
    module: 'default',
    maxSize: 5,
    aspectRatio: '',
    shape: 'square',
    size: 96,
    upload: uploadFile,
  },
);

const modelValue = defineModel<string>();

const loading = ref(false);
const rawImg = ref('');
const cropperRef = ref<InstanceType<typeof VCropper>>();
const fileInputRef = ref<HTMLInputElement>();

const [CropModal, cropModalApi] = useVbenModal({
  async onConfirm() {
    const cropper = cropperRef.value;
    if (!cropper) return;
    const blob = await cropper.getCropImage('image/png', 0.92, 'blob');
    if (!blob || !(blob instanceof Blob)) return;
    loading.value = true;
    try {
      const file = new File([blob], `cover-${Date.now()}.png`, {
        type: 'image/png',
      });
      const info = await props.upload(file, props.module);
      if (!info.url) {
        message.error($t('system.common.fileUrlUnavailable'));
        return;
      }
      modelValue.value = info.url;
      message.success($t('common.success'));
      cropModalApi.close();
    } finally {
      loading.value = false;
    }
  },
});

function onPick() {
  fileInputRef.value?.click();
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    message.error($t('system.common.imageOnly'));
    return;
  }
  if (file.size / 1024 / 1024 > props.maxSize) {
    message.error($t('ui.formRules.sizeLimit', [props.maxSize]));
    return;
  }
  rawImg.value = URL.createObjectURL(file);
  cropModalApi.open();
}

function onRemove() {
  modelValue.value = undefined;
}
</script>
<template>
  <div class="flex items-center gap-3">
    <div
      class="group border-border hover:border-primary relative flex cursor-pointer items-center justify-center overflow-hidden border border-dashed"
      :class="shape === 'circle' ? 'rounded-full' : 'rounded'"
      :style="{ width: `${size}px`, height: `${size}px` }"
      @click="onPick"
    >
      <img
        v-if="modelValue"
        :src="modelValue"
        class="size-full object-cover"
        alt="image"
      />
      <IconifyIcon
        v-else
        :icon="loading ? 'lucide:loader-circle' : 'lucide:image-plus'"
        :class="loading ? 'animate-spin' : ''"
        class="text-foreground/50 size-6"
      />
      <!-- 有图时 hover 显示"更换"遮罩：点图即可重新上传 -->
      <div
        v-if="modelValue"
        class="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <IconifyIcon icon="lucide:camera" class="size-5" />
      </div>
    </div>
    <div v-if="shape === 'square'" class="flex flex-col gap-1">
      <a class="text-primary text-xs" @click="onPick">
        {{ $t('ui.placeholder.upload') }}
      </a>
      <a v-if="modelValue" class="text-destructive text-xs" @click="onRemove">
        {{ $t('common.delete') }}
      </a>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    />

    <CropModal :title="$t('system.notice.cover')" class="w-[560px]">
      <div class="flex justify-center p-2">
        <VCropper
          v-if="rawImg"
          ref="cropperRef"
          :img="rawImg"
          :aspect-ratio="aspectRatio"
          :width="480"
          :height="360"
        />
      </div>
    </CropModal>
  </div>
</template>
