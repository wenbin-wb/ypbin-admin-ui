import { proxyRefs } from 'vue';

import { describe, expect, it } from 'vitest';

import Avatar from '../avatar.vue';

/**
 * 取 `Avatar` 中「无头像时的回退文字」。
 *
 * 本仓未引入 `@vue/test-utils`，且 vitest 的 happy-dom 配置把「文件加载被禁用」当作成功
 * （见根 `vitest.config.ts`），挂载后无法稳定复现「图片加载失败 → 渲染回退文字」这条路径。
 * 因此这里直接走 SFC 编译产物的稳定契约：`setup(props)` 返回的绑定对象
 * （模板渲染时同样是 `$setup.text` 求值），用 `proxyRefs` 解开 computed。
 *
 * `text` 的求值就是生产环境抛错的时刻——`Cannot read properties of null (reading 'slice')`
 * 来自 `apps/web-antd` 产物 chunk `avatar-*.js` 中的 `alt.slice(-2)`。
 */
function fallbackText(alt: null | string | undefined): string {
  const component = Avatar as unknown as {
    setup: (
      props: Record<string, unknown>,
      ctx: Record<string, unknown>,
    ) => Record<string, unknown>;
  };
  const setupState = proxyRefs(
    component.setup(
      { alt, as: 'button', dot: false, dotClass: 'bg-green-500', fit: 'cover' },
      { attrs: {}, emit: () => {}, expose: () => {}, slots: {} },
    ),
  ) as { text: string };
  return setupState.text;
}

describe('VbenAvatar 回退文字', () => {
  it('alt 为 null（后端 realName 为 null）时不抛异常，回退值同「未提供 alt」', () => {
    expect(fallbackText(null)).toBe('AR');
    expect(fallbackText(undefined)).toBe('AR');
  });

  it('正常 alt 取末两位并大写（行为不变）', () => {
    expect(fallbackText('zhang san')).toBe('AN');
    expect(fallbackText('李四')).toBe('李四');
  });
});
