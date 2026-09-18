import type { RouteRecordNormalized } from 'vue-router';

import { useRouter } from 'vue-router';

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
 * 是否为「布局容器」路由。
 *
 * 判据是「既有子路由又带重定向」：`/`（`meta.title = "Root"`）与 `/auth`
 * （`"Authentication"`）这类路由只是分组容器，本身不是页面，它们的标题是分组名。
 * 把分组名当页面名展示（例如把首屏异常事件的 `pageUrl: "/"` 显示成 `Root`）
 * 比回退原始地址更误导，故这类路由不参与反查。
 */
function isContainerRoute(route: RouteRecordNormalized): boolean {
  return route.children.length > 0 && route.redirect !== undefined;
}

/**
 * 页面地址 → 菜单标题 / 路由标题。
 *
 * 两级反查，都命中不到才回退原始地址：
 * 1. **菜单树**：登录后已写入 `useAccessStore().accessMenus`，`getMenuByPath` 是
 *    store 自带的精确路径查找 action；命中的标题走 `$t(menu.name)` 翻译——
 *    store 里的 `name` 是 i18n key，布局层也是这么翻译的（保持原有行为与优先级）。
 * 2. **路由表**：菜单树只由后端动态路由生成（见
 *    `packages/effects/access/src/accessible.ts`），`/auth/login`、`/profile`
 *    这类静态注册的核心路由（`#/router/routes/core.ts`）不在菜单里，只查菜单会
 *    回退成原始地址。这里读路由自身的 `meta.title`——与 SDK 为 `ui.page.view`
 *    采集 `to.meta.title` 是同一个数据源（见 `packages/tracking/src/collectors.ts`），
 *    所以不是第二套映射。
 *
 * 未命中时**回退为原始地址**而不是空串：菜单树只包含 `hideInMenu !== true` 的可见项，
 * 详情页等隐藏路由本来就不会出现在菜单里，"这个地址不在菜单中"是需要暴露的信息。
 *
 * 已知边界：只做**精确路径**匹配，带参数的详情路由（如 `/system/user/:id`）匹配不到，
 * 仍会回退原始地址；不做模式匹配是为了避免命中 catch-all（`/:path(.*)*`）而误显示 404 标题。
 */
export function usePageTitle() {
  const accessStore = useAccessStore();
  const router = useRouter();

  function routeTitleOf(path: string): string {
    const record = router
      .getRoutes()
      .find((route) => route.path === path && !isContainerRoute(route));
    const title: unknown = record?.meta?.title;
    return typeof title === 'string' ? title : '';
  }

  function pageTitle(pageUrl?: string): string {
    const raw = pageUrl?.trim() ?? '';
    if (!raw) {
      return '';
    }
    const path = toRoutePath(raw);
    if (path) {
      const menu = accessStore.getMenuByPath(path);
      if (menu) {
        return $t(menu.name);
      }
      const routeTitle = routeTitleOf(path);
      if (routeTitle) {
        return $t(routeTitle);
      }
    }
    return raw;
  }

  return { pageTitle };
}
