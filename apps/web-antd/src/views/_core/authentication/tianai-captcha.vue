<script lang="ts" setup>
import type { AuthApi } from '#/api/core/auth';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { getCaptchaApi } from '#/api/core/auth';
import { $t } from '#/locales';

/** 完成一次拖动后回调，携带后端校验所需的数据 */
export interface TianaiCaptchaPayload {
  id: string;
  track: AuthApi.CaptchaTrack;
}

defineOptions({ name: 'VbenTianaiCaptcha' });

const props = withDefaults(
  defineProps<{
    /** 是否已完成拖动（表单校验用） */
    modelValue?: boolean;
    /** 完成拖动后回调 */
    onVerify?: (payload: TianaiCaptchaPayload) => void;
    /** 容器宽度 */
    width?: number;
  }>(),
  { modelValue: false, onVerify: undefined, width: 300 },
);

const emit = defineEmits<{
  'update:modelValue': [boolean];
  verify: [payload: TianaiCaptchaPayload];
}>();

const captcha = ref<AuthApi.CaptchaVo | null>(null);
const loading = ref(true);
const loadFailed = ref(false);
const dragging = ref(false);
const dragX = ref(0);
const startTime = ref(0);
const startY = ref(0);

const HANDLE_WIDTH = 40;
let downPageX = 0;

const scale = computed(() =>
  captcha.value ? captcha.value.backgroundImageWidth / props.width : 1,
);
const imageHeight = computed(() =>
  captcha.value ? captcha.value.backgroundImageHeight / scale.value : 150,
);
// 模板图与背景按同一缩放系数渲染，拼块才能与背景凹槽对齐；若按背景框尺寸铺满会被拉变形
const templateWidth = computed(() =>
  captcha.value ? captcha.value.templateImageWidth / scale.value : 0,
);
const templateHeight = computed(() =>
  captcha.value ? captcha.value.templateImageHeight / scale.value : 0,
);
const maxDragX = computed(() => props.width - HANDLE_WIDTH);
const statusText = computed(() => {
  if (loadFailed.value) {
    return $t('ui.captcha.tianaiLoadFailed');
  }
  return dragging.value
    ? $t('ui.captcha.tianaiDragging')
    : $t('ui.captcha.tianaiDefaultText');
});

async function fetchCaptcha() {
  loading.value = true;
  loadFailed.value = false;
  dragX.value = 0;
  // 重新拉取时若之前已拖动通过，需重置为未验证；首次加载保持原值避免表单过早报错
  if (props.modelValue) {
    emit('update:modelValue', false);
  }
  try {
    const resp = await getCaptchaApi();
    const vo = resp?.data ?? null;
    captcha.value = vo;
    if (!vo) {
      // 后端未开启行为验证码时无需校验，直接放行
      emit('update:modelValue', true);
    }
  } catch {
    captcha.value = null;
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
}

function pointerDown(e: PointerEvent) {
  if (dragging.value || !captcha.value) return;
  dragging.value = true;
  downPageX = e.clientX;
  startTime.value = Date.now();
  startY.value = e.clientY;
  window.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);
}

function pointerMove(e: PointerEvent) {
  if (!dragging.value) return;
  const delta = e.clientX - downPageX;
  dragX.value = Math.min(maxDragX.value, Math.max(0, delta));
}

function pointerUp() {
  if (!dragging.value) return;
  dragging.value = false;
  window.removeEventListener('pointermove', pointerMove);
  window.removeEventListener('pointerup', pointerUp);
  const vo = captcha.value;
  if (!vo) return;

  const stopTime = Date.now();
  const duration = stopTime - startTime.value;
  const y = startY.value * scale.value;
  const nativeX = dragX.value * scale.value;
  const track: AuthApi.CaptchaTrack = {
    bgImageWidth: vo.backgroundImageWidth,
    bgImageHeight: vo.backgroundImageHeight,
    templateImageWidth: vo.templateImageWidth,
    templateImageHeight: vo.templateImageHeight,
    startTime: startTime.value,
    stopTime,
    left: Math.round(nativeX),
    top: 0,
    trackList: [
      { x: 0, y, t: startTime.value, type: 'DOWN' },
      {
        x: nativeX * 0.4,
        y,
        t: startTime.value + duration * 0.4,
        type: 'MOVE',
      },
      {
        x: nativeX * 0.8,
        y,
        t: startTime.value + duration * 0.8,
        type: 'MOVE',
      },
      { x: nativeX, y, t: stopTime, type: 'UP' },
    ],
  };
  const payload: TianaiCaptchaPayload = { id: vo.id, track };
  emit('verify', payload);
  emit('update:modelValue', true);
  props.onVerify?.(payload);
}

onMounted(fetchCaptcha);
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', pointerMove);
  window.removeEventListener('pointerup', pointerUp);
});
</script>

<template>
  <div v-if="captcha" class="select-none">
    <div
      class="relative overflow-hidden rounded-md"
      :style="{ width: `${width}px`, height: `${imageHeight}px` }"
    >
      <img
        :src="captcha.backgroundImage"
        alt=""
        class="block h-full w-full"
        draggable="false"
      />
      <img
        :src="captcha.templateImage"
        alt=""
        class="absolute top-0 left-0 max-w-none"
        draggable="false"
        :style="{
          width: `${templateWidth}px`,
          height: `${templateHeight}px`,
          transform: `translateX(${dragX}px)`,
        }"
      />
      <span
        class="absolute top-2 right-2 flex size-6 cursor-pointer items-center justify-center rounded-full bg-background/70 text-xs text-foreground/70 hover:text-foreground"
        @click="fetchCaptcha"
      >
        ⟳
      </span>
    </div>
    <div
      class="relative mt-2 h-10 overflow-hidden rounded-md border border-input bg-background-deep"
      :style="{ width: `${width}px` }"
      @pointerdown="pointerDown"
    >
      <div
        class="absolute top-0 left-0 h-full bg-primary/20"
        :style="{ width: `${dragX}px` }"
      ></div>
      <div
        class="absolute top-0 flex h-full items-center justify-center border-r border-input bg-primary text-primary-foreground text-sm"
        :style="{
          width: `${HANDLE_WIDTH}px`,
          transform: `translateX(${dragX}px)`,
        }"
      >
        <IconifyIcon class="size-4" icon="lucide:move-right" />
      </div>
      <span
        class="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none"
      >
        {{ statusText }}
      </span>
    </div>
  </div>
  <div
    v-else-if="loading"
    class="flex h-10 items-center justify-center text-xs text-muted-foreground"
    :style="{ width: `${width}px` }"
  >
    {{ $t('ui.captcha.tianaiLoading') }}
  </div>
  <div
    v-else-if="loadFailed"
    class="flex h-10 items-center justify-center gap-2 text-xs"
    :style="{ width: `${width}px` }"
  >
    <span class="text-red-500">{{ $t('ui.captcha.tianaiLoadFailed') }}</span>
    <button
      class="vben-link text-sm font-normal"
      type="button"
      @click="fetchCaptcha"
    >
      {{ $t('common.refresh') }}
    </button>
  </div>
</template>
