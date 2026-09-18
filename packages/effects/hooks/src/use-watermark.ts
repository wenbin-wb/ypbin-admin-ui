import type { Watermark, WatermarkOptions } from 'watermark-js-plus';

import { nextTick, onUnmounted, readonly, ref } from 'vue';

const watermark = ref<Watermark>();
const unmountedHooked = ref<boolean>(false);
const cachedOptions = ref<Partial<WatermarkOptions>>({
  advancedStyle: {
    colorStops: [
      {
        color: 'gray',
        offset: 0,
      },
      {
        color: 'gray',
        offset: 1,
      },
    ],
    type: 'linear',
  },
  // fontSize: '20px',
  content: '',
  contentType: 'multi-line-text',
  globalAlpha: 0.25,
  gridLayoutOptions: {
    cols: 2,
    gap: [20, 20],
    matrix: [
      [1, 0],
      [0, 1],
    ],
    rows: 2,
  },
  height: 200,
  layout: 'grid',
  rotate: 30,
  width: 160,
});

/**
 * 水印文案片段的输入形态。
 *
 * 之所以要允许 `null`：片段来自后端会返回 `null` 的可空字段
 * （`BasicUserInfo.realName`，对应 DB 里允许 NULL 的 `sys_user.real_name`），
 * 而 `userStore.userInfo` 本身未加载时取到的是 `undefined`——两者都不能直接插值。
 */
type WatermarkTextPart = null | string | undefined;

/**
 * 单个片段的归一：只保留「非空字符串」，其余（`null` / `undefined` / 空串 / 纯空白）
 * 一律视为「没有内容」。
 *
 * 非空片段原样返回（不做 trim），避免改变既有正常值的显示。
 */
function normalizePart(part: WatermarkTextPart): string {
  if (typeof part !== 'string' || part.trim() === '') {
    return '';
  }
  return part;
}

/**
 * 归一水印文案：自定义文案优先，否则用「用户名 - 显示名」拼接。
 *
 * 拼接对 `null` / `undefined` / 空串稳健——先把不可用片段整段丢掉再拼接，
 * 绝不把 `undefined` / `null` 字面量写进水印（修复前 `content || \`${username} - ${realName}\``
 * 在 `realName` 为 `null` 时会渲染出 `admin - null`）：
 * - 两段都可用 → `用户名 - 显示名`（与既有表现完全一致）；
 * - 只有一段可用 → 只显示那一段，不留悬空的分隔符；
 * - 都不可用 → 返回空串。空串是水印模块自身 `cachedOptions.content` 的默认值，
 *   语义就是「没有可展示的文案」，而不是显示占位垃圾。
 */
export function resolveWatermarkContent(options: {
  content?: WatermarkTextPart;
  realName?: WatermarkTextPart;
  username?: WatermarkTextPart;
}): string {
  const custom = normalizePart(options.content);
  if (custom) {
    return custom;
  }
  return [normalizePart(options.username), normalizePart(options.realName)]
    .filter((part) => part !== '')
    .join(' - ');
}

export function useWatermark() {
  async function initWatermark(options: Partial<WatermarkOptions>) {
    const { Watermark } = await import('watermark-js-plus');

    cachedOptions.value = {
      ...cachedOptions.value,
      ...options,
    };
    watermark.value = new Watermark(cachedOptions.value);
    await watermark.value?.create();
  }

  async function updateWatermark(options: Partial<WatermarkOptions>) {
    if (watermark.value) {
      await nextTick();
      await watermark.value?.changeOptions({
        ...cachedOptions.value,
        ...options,
      });
    } else {
      await initWatermark(options);
    }
  }

  function destroyWatermark() {
    if (watermark.value) {
      watermark.value.destroy();
      watermark.value = undefined;
    }
  }

  // 只在第一次调用时注册卸载钩子，防止重复注册以致于在路由切换时销毁了水印
  if (!unmountedHooked.value) {
    unmountedHooked.value = true;
    onUnmounted(() => {
      destroyWatermark();
    });
  }

  return {
    destroyWatermark,
    updateWatermark,
    watermark: readonly(watermark),
  };
}
