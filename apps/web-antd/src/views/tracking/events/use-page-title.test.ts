import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePageTitle } from './use-page-title';

interface TestMenu {
  children?: TestMenu[];
  name: string;
  path: string;
}

const access = vi.hoisted(() => ({ menus: [] as TestMenu[] }));

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

vi.mock('#/locales', () => ({
  // 用可断言的假翻译替代 i18n：store 里的菜单 name 是 i18n key
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

  it('映射不到菜单时回退原始地址，而不是空串', () => {
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
