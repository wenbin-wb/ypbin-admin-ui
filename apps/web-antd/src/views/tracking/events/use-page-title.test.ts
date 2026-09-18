import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePageTitle } from './use-page-title';

interface TestMenu {
  children?: TestMenu[];
  name: string;
  path: string;
}

interface TestRoute {
  children?: unknown[];
  meta?: { title?: unknown };
  path: string;
  redirect?: unknown;
}

const access = vi.hoisted(() => ({ menus: [] as TestMenu[] }));
const routeTable = vi.hoisted(() => ({ records: [] as TestRoute[] }));

vi.mock('@vben/stores', () => ({
  // 复刻 `packages/stores/src/modules/access.ts` 里 getMenuByPath 的语义：
  // 按 path 精确匹配、深度优先。行为不一致时本用例必须失败。
  useAccessStore: () => ({
    getMenuByPath(path: string) {
      function find(list: TestMenu[]): TestMenu | undefined {
        for (const menu of list) {
          if (menu.path === path) {
            return menu;
          }
          const matched = menu.children ? find(menu.children) : undefined;
          if (matched) {
            return matched;
          }
        }
        return undefined;
      }
      return find(access.menus);
    },
  }),
}));

// 路由表反查标题的来源（真实实现是 vue-router 实例的 `getRoutes()`）
vi.mock('vue-router', () => ({
  useRouter: () => ({ getRoutes: () => routeTable.records }),
}));

vi.mock('#/locales', () => ({
  // 用可断言的假翻译替代 i18n：store 里的菜单 name 与路由 meta.title 都是 i18n key
  $t: (key: string) => `translated:${key}`,
}));

describe('usePageTitle', () => {
  beforeEach(() => {
    access.menus = [
      { name: 'page.dashboard.title', path: '/dashboard' },
      {
        children: [{ name: 'system.log.title', path: '/system/log' }],
        name: 'system.sys.title',
        path: '/system/sys',
      },
    ];
    routeTable.records = [
      // 布局容器：有子路由且带重定向，本身不是页面（形状取自
      // `#/router/routes/core.ts` 的 Root 与 Authentication）
      {
        children: [{ path: 'login' }],
        meta: { title: 'Root' },
        path: '/',
        redirect: '/dashboard',
      },
      {
        children: [{ path: 'login' }],
        meta: { title: 'Authentication' },
        path: '/auth',
        redirect: '/auth/login',
      },
      // 核心路由（静态注册，不进动态菜单）：使用者上报的登录页，以及 hideInMenu 的个人中心
      { children: [], meta: { title: 'page.auth.login' }, path: '/auth/login' },
      { children: [], meta: { title: 'page.auth.profile' }, path: '/profile' },
    ];
  });

  it('把命中的菜单路径翻译成菜单标题', () => {
    const { pageTitle } = usePageTitle();
    expect(pageTitle('/system/sys')).toBe('translated:system.sys.title');
  });

  it('支持菜单树里的子菜单路径', () => {
    const { pageTitle } = usePageTitle();
    expect(pageTitle('/system/log')).toBe('translated:system.log.title');
  });

  it('归一化后仍能命中：查询串、哈希、末尾斜杠、绝对地址', () => {
    const { pageTitle } = usePageTitle();
    expect(pageTitle('/system/sys?page=2')).toBe('translated:system.sys.title');
    expect(pageTitle('/system/sys#anchor')).toBe('translated:system.sys.title');
    expect(pageTitle('/system/sys/')).toBe('translated:system.sys.title');
    expect(pageTitle('https://admin.example.com/system/sys')).toBe(
      'translated:system.sys.title',
    );
  });

  it('菜单未命中时回退路由表：离页事件（payload 无 routeTitle）也能显示中文页面名', () => {
    const { pageTitle } = usePageTitle();
    // 使用者上报的登录页：`ui.page.leave` 的 payload 只有 `routeKey`（无 routeTitle），
    // 而列表「页面」列只拿 `pageUrl` 解析（`list.vue` / `modules/detail.vue`），
    // 故离页事件与页面浏览事件解析结果一致，都能拿到中文页面名
    expect(pageTitle('/auth/login')).toBe('translated:page.auth.login');
    expect(pageTitle('/auth/login?redirect=%2Fdashboard')).toBe(
      'translated:page.auth.login',
    );
    // hideInMenu 的个人中心同样不在菜单里，修复前会显示 `/profile`
    expect(pageTitle('/profile')).toBe('translated:page.auth.profile');
  });

  it('菜单优先级高于路由表', () => {
    const { pageTitle } = usePageTitle();
    // `/dashboard` 同时存在于菜单与路由表时，用菜单标题
    routeTable.records.push({
      children: [],
      meta: { title: 'route.dashboard.title' },
      path: '/dashboard',
    });
    expect(pageTitle('/dashboard')).toBe('translated:page.dashboard.title');
  });

  it('布局容器路由不参与反查，避免把分组名（Root/Authentication）当页面名', () => {
    const { pageTitle } = usePageTitle();
    expect(pageTitle('/')).toBe('/');
    expect(pageTitle('/auth')).toBe('/auth');
  });

  it('映射不到菜单与路由时回退原始地址，而不是空串', () => {
    const { pageTitle } = usePageTitle();
    expect(pageTitle('/system/user')).toBe('/system/user');
    expect(pageTitle('/tracking/events')).toBe('/tracking/events');
  });

  it('地址为空时返回空串（不是 undefined）', () => {
    const { pageTitle } = usePageTitle();
    expect(pageTitle()).toBe('');
    expect(pageTitle('')).toBe('');
    expect(pageTitle('   ')).toBe('');
  });

  it('已知边界：hash 路由（#/xxx）会被解析成根路径，从而回退原始地址', () => {
    const { pageTitle } = usePageTitle();
    expect(pageTitle('#/system/sys')).toBe('#/system/sys');
  });
});
