import { requestClient } from '#/api/request';

export namespace SystemMenuApi {
  /** 徽标颜色集合 */
  export const BadgeVariants = [
    'default',
    'destructive',
    'primary',
    'success',
    'warning',
  ] as const;
  /** 徽标类型集合 */
  export const BadgeTypes = ['dot', 'normal'] as const;
  /** 菜单类型集合 */
  export const MenuTypes = [
    'catalog',
    'menu',
    'embedded',
    'link',
    'button',
  ] as const;
  export interface MenuSaveReq {
    activeIcon?: string;
    activePath?: string;
    affixTab?: boolean;
    authCode?: string;
    badge?: string;
    badgeType?: (typeof BadgeTypes)[number];
    badgeVariants?: (typeof BadgeVariants)[number];
    component?: string;
    hideChildrenInMenu?: boolean;
    hideInBreadcrumb?: boolean;
    hideInMenu?: boolean;
    hideInTab?: boolean;
    icon?: string;
    iframeSrc?: string;
    keepAlive?: boolean;
    link?: string;
    name: string;
    path?: string;
    pid?: string;
    platformOnly?: boolean;
    redirect?: string;
    sort?: number;
    status: 0 | 1;
    title?: string;
    type: (typeof MenuTypes)[number];
  }

  /** 菜单管理响应，字段与保存请求保持同名。 */
  export interface SystemMenu extends MenuSaveReq {
    children?: SystemMenu[];
    id: string;
    pid: string;
  }
}

/**
 * 获取菜单数据列表
 */
async function getMenuList() {
  return requestClient.get<Array<SystemMenuApi.SystemMenu>>(
    '/system/menu/list',
  );
}

async function isMenuNameExists(
  name: string,
  id?: SystemMenuApi.SystemMenu['id'],
) {
  return requestClient.get<boolean>('/system/menu/name-exists', {
    params: { id, name },
  });
}

async function isMenuPathExists(
  path: string,
  id?: SystemMenuApi.SystemMenu['id'],
) {
  return requestClient.get<boolean>('/system/menu/path-exists', {
    params: { id, path },
  });
}

/**
 * 创建菜单
 * @param data 菜单数据
 */
async function createMenu(data: SystemMenuApi.MenuSaveReq) {
  return requestClient.post('/system/menu', data);
}

/**
 * 更新菜单
 *
 * @param id 菜单 ID
 * @param data 菜单数据
 */
async function updateMenu(id: string, data: SystemMenuApi.MenuSaveReq) {
  return requestClient.put(`/system/menu/${id}`, data);
}

/**
 * 删除菜单
 * @param id 菜单 ID
 */
async function deleteMenu(id: string) {
  return requestClient.delete(`/system/menu/${id}`);
}

export {
  createMenu,
  deleteMenu,
  getMenuList,
  isMenuNameExists,
  isMenuPathExists,
  updateMenu,
};
