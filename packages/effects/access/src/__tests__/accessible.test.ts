import type { GenerateMenuAndRoutesOptions, RouteRecordRaw } from '@vben/types';

import { describe, expect, it } from 'vitest';

import { generateAccessible } from '../accessible';

// generateAccessible 会操作传入的 router 实例。这里用最小 stub 覆盖它实际调用的方法：
// - getRoutes(): 返回 [] -> 不存在根路由 '/', 走 router.addRoute 分支
// - addRoute/removeRoute: 空实现
// 我们只断言返回的 accessibleRoutes 上自动生成的 redirect。
function createRouterStub() {
  return {
    addRoute: () => {},
    getRoutes: () => [],
    removeRoute: () => {},
  } as any;
}

async function generate(routes: RouteRecordRaw[]) {
  const { accessibleRoutes } = await generateAccessible('frontend', {
    router: createRouterStub(),
    routes,
  });
  return accessibleRoutes;
}

function findByName(
  routes: RouteRecordRaw[],
  name: string,
): RouteRecordRaw | undefined {
  for (const route of routes) {
    if (route.name === name) {
      return route;
    }
    if (route.children) {
      const found = findByName(route.children as RouteRecordRaw[], name);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

describe('generateAccessible - redirect normalization', () => {
  it('不为动态参数(:id)首子路由的父级生成 redirect', async () => {
    const routes = [
      {
        name: 'DyeSets',
        path: 'dye-sets',
        children: [
          {
            name: 'DyeSetDetail',
            path: ':id',
            meta: { hideInMenu: true, title: 'detail' },
          },
        ],
        meta: { title: 'dye-sets' },
      },
    ] as unknown as RouteRecordRaw[];

    const result = await generate(routes);
    expect(findByName(result, 'DyeSets')?.redirect).toBeUndefined();
  });

  it('父级为对象 redirect({name}) 且含 :id 子路由时不抛异常且不生成 redirect', async () => {
    const routes = [
      {
        name: 'Production',
        path: '/production',
        redirect: { name: 'ProductionTasks' },
        children: [
          {
            name: 'ProductionTasks',
            path: 'production-tasks',
            children: [
              {
                name: 'ProductionTaskDetail',
                path: ':id',
                meta: { hideInMenu: true, title: 'detail' },
              },
              {
                name: 'ProductionTaskMatch',
                path: ':id/match',
                meta: { hideInMenu: true, title: 'match' },
              },
            ],
            meta: { title: 'tasks' },
          },
        ],
        meta: { title: 'production' },
      },
    ] as unknown as RouteRecordRaw[];

    const result = await generate(routes);
    // 顶级对象 redirect 保持不变
    expect(findByName(result, 'Production')?.redirect).toEqual({
      name: 'ProductionTasks',
    });
    // :id 首子路由的父级不生成 redirect
    expect(findByName(result, 'ProductionTasks')?.redirect).toBeUndefined();
  });

  it('父级为对象 redirect 时，普通相对首子路由回退用 parent.path 拼接', async () => {
    const routes = [
      {
        name: 'Setting',
        path: '/setting',
        redirect: { name: 'SettingService' },
        children: [
          {
            name: 'SettingGroup',
            path: 'group',
            children: [
              {
                name: 'SettingService',
                path: 'service',
                meta: { title: 'service' },
              },
            ],
            meta: { title: 'group' },
          },
        ],
        meta: { title: 'setting' },
      },
    ] as unknown as RouteRecordRaw[];

    const result = await generate(routes);
    expect(findByName(result, 'SettingGroup')?.redirect).toBe(
      '/setting/group/service',
    );
  });

  it('深层嵌套(上游风格)相对路径逐级生成正确的累计绝对 redirect', async () => {
    const routes = [
      {
        name: 'Demos',
        path: '/demos',
        children: [
          {
            name: 'NestedDemos',
            path: 'nested',
            children: [
              {
                name: 'Menu1Demo',
                path: 'menu1',
                meta: { title: 'menu1' },
              },
              {
                name: 'Menu2Demo',
                path: 'menu2',
                children: [
                  {
                    name: 'Menu21Demo',
                    path: 'menu2-1',
                    meta: { title: 'menu2-1' },
                  },
                ],
                meta: { title: 'menu2' },
              },
            ],
            meta: { title: 'nested' },
          },
        ],
        meta: { title: 'demos' },
      },
    ] as unknown as RouteRecordRaw[];

    const result = await generate(routes);
    // Demos 重定向到第一级子路由，子路由继续级联到叶子
    expect(findByName(result, 'Demos')?.redirect).toBe('/demos/nested');
    expect(findByName(result, 'NestedDemos')?.redirect).toBe(
      '/demos/nested/menu1',
    );
    expect(findByName(result, 'Menu2Demo')?.redirect).toBe(
      '/demos/nested/menu2/menu2-1',
    );
  });

  it('首子路由为绝对路径(/foo)时不生成 redirect', async () => {
    const routes = [
      {
        name: 'Dashboard',
        path: '/dashboard',
        children: [
          {
            name: 'Analytics',
            path: '/analytics',
            meta: { title: 'analytics' },
          },
        ],
        meta: { title: 'dashboard' },
      },
    ] as unknown as RouteRecordRaw[];

    const result = await generate(routes);
    expect(findByName(result, 'Dashboard')?.redirect).toBeUndefined();
  });

  it('首子路由为空 path 时不生成 redirect', async () => {
    const routes = [
      {
        name: 'HideChildrenParent',
        path: 'hide-menu-children',
        children: [
          {
            name: 'HideChildren',
            path: '',
            meta: { title: 'hide' },
          },
        ],
        meta: { title: 'parent' },
      },
    ] as unknown as RouteRecordRaw[];

    const result = await generate(routes);
    expect(findByName(result, 'HideChildrenParent')?.redirect).toBeUndefined();
  });

  it('已存在的 redirect 保持不变', async () => {
    const routes = [
      {
        name: 'Custom',
        path: '/custom',
        redirect: '/custom/keep',
        children: [
          {
            name: 'CustomChild',
            path: 'child',
            meta: { title: 'child' },
          },
        ],
        meta: { title: 'custom' },
      },
    ] as unknown as RouteRecordRaw[];

    const result = await generate(routes);
    expect(findByName(result, 'Custom')?.redirect).toBe('/custom/keep');
  });
});

describe('generateAccessible - 嵌套布局组件只保留一层', () => {
  const BasicLayout = async () => ({ default: {} });
  const RoleListPage = async () => ({ default: {} });
  const DeviceDetailPage = async () => ({ default: {} });

  // 贴近真实 vue-router：根路由 '/'（= BasicLayout）已存在，
  // generateAccessible 会把顶级路由挂到它的 children 上。
  function createRouterStub() {
    const root = { children: [] as RouteRecordRaw[], name: 'Root', path: '/' };
    return {
      addRoute: () => {},
      getRoutes: () => [root],
      removeRoute: () => {},
    } as any;
  }

  async function generateByBackend() {
    const options = {
      fetchMenuListAsync: async () => [
        {
          name: 'Admin',
          path: '/admin',
          component: 'BasicLayout',
          meta: { title: '基础管理' },
          children: [
            {
              name: 'AuthManage',
              path: '/system/auth',
              component: 'BasicLayout',
              meta: { title: '权限管理' },
              children: [
                {
                  name: 'SystemRole',
                  path: '/system/role',
                  component: '/system/role/list',
                  meta: { title: '角色管理' },
                },
              ],
            },
            {
              // 带子路由的业务页面：component 不在 layoutMap 里，必须原样保留。
              // 放在二级（非顶级）——顶级路由带子路由时上游逻辑会无条件删 component。
              name: 'DeviceDetail',
              path: '/iot/devices/:id',
              component: '/iot/devices/detail',
              meta: { title: '设备详情' },
              children: [
                {
                  name: 'DeviceAlerts',
                  path: 'alerts',
                  component: '/iot/devices/detail',
                  meta: { title: '告警' },
                },
              ],
            },
          ],
        },
      ],
      layoutMap: { BasicLayout },
      pageMap: {
        '/iot/devices/detail.vue': DeviceDetailPage,
        '/system/role/list.vue': RoleListPage,
      },
      router: createRouterStub(),
      routes: [],
    } as unknown as GenerateMenuAndRoutesOptions;

    const { accessibleRoutes } = await generateAccessible('backend', options);
    return accessibleRoutes;
  }

  it('二级目录（非顶级的 BasicLayout）被删除，页面组件保留', async () => {
    const result = await generateByBackend();

    // 顶级目录：原有逻辑删除
    expect(findByName(result, 'Admin')?.component).toBeUndefined();
    // 二级目录：挂到 /admin 之下后不再是顶级，由新增的全树清理兜住
    expect(findByName(result, 'AuthManage')?.component).toBeUndefined();
    // 叶子页面组件不动
    expect(findByName(result, 'SystemRole')?.component).toBe(RoleListPage);
  });

  it('带子路由的业务页面组件不被误删', async () => {
    const result = await generateByBackend();

    expect(findByName(result, 'DeviceDetail')?.component).toBe(
      DeviceDetailPage,
    );
    expect(findByName(result, 'DeviceAlerts')?.component).toBe(
      DeviceDetailPage,
    );
  });
});
