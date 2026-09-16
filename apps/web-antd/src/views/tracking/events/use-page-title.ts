import { useAccessStore } from '@vben/stores';

import { $t } from '#/locales';

/**
 * 取出地址的 pathname。
 *
 * 埋点 SDK 落库前已用 `sanitizeUrl` 去掉查询串与哈希（见
 * `packages/tracking/src/context.ts`），但后端/IoT 侧上报的地址不受该约束，
 * 因此这里再做一次防御性归一。
 */
function parsePathname(rawUrl: string): string {
  try {
    return new URL(rawUrl, 'http://localhost').pathname;
  } catch {
    // 非标准地址（如自定义协议）退化为手工剥离查询串与哈希
    return rawUrl.split(/[?#]/)[0] ?? rawUrl;
  }
}

/** 归一成菜单树里使用的路由路径形式（顺带去掉末尾斜杠） */
function toRoutePath(rawUrl: string): string {
  const path = parsePathname(rawUrl);
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * 页面地址 → 菜单标题。
 *
 * 菜单树取自动态菜单（登录后已写入 `useAccessStore().accessMenus`，
 * `getMenuByPath` 是 store 自带的精确路径查找 action）；命中的标题走 `$t(menu.name)`
 * 翻译——store 里的 `name` 是 i18n key，布局层也是这么翻译的。
 *
 * 未命中时**回退为原始地址**而不是空串：菜单树只包含 `hideInMenu !== true` 的可见项，
 * 详情页等隐藏路由本来就不会出现在菜单里，"这个地址不在菜单中"是需要暴露的信息。
 */
export function usePageTitle() {
  const accessStore = useAccessStore();

  function pageTitle(pageUrl?: string): string {
    const raw = pageUrl?.trim() ?? '';
    if (!raw) {
      return '';
    }
    const path = toRoutePath(raw);
    const menu = path ? accessStore.getMenuByPath(path) : undefined;
    return menu ? $t(menu.name) : raw;
  }

  return { pageTitle };
}
