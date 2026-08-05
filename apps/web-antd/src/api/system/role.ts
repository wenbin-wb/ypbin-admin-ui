import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemRoleApi {
  export interface SystemRole {
    [key: string]: any;
    id: string;
    name: string;
    code: string;
    dataScope?: number;
    sort?: number;
    permissions?: string[];
    remark?: string;
    status: 0 | 1;
    statusText?: string;
    createTime?: string;
    createUserName?: string;
  }
}

/**
 * 获取角色列表数据
 */
async function getRoleList(params: Recordable<any>) {
  return requestClient.get<Array<SystemRoleApi.SystemRole>>(
    '/system/role/list',
    { params },
  );
}

/**
 * 创建角色
 * @param data 角色数据
 */
async function createRole(data: Omit<SystemRoleApi.SystemRole, 'id'>) {
  return requestClient.post('/system/role', data);
}

/**
 * 更新角色
 *
 * @param id 角色 ID
 * @param data 角色数据
 */
async function updateRole(
  id: string,
  data: Omit<SystemRoleApi.SystemRole, 'id'>,
) {
  return requestClient.put(`/system/role/${id}`, data);
}

/**
 * 删除角色
 * @param id 角色 ID
 */
async function deleteRole(id: string) {
  return requestClient.delete(`/system/role/${id}`);
}

/**
 * 获取所有角色（下拉用）
 */
async function getRoleAll() {
  return requestClient.get<Array<SystemRoleApi.SystemRole>>('/system/role/all');
}

export { createRole, deleteRole, getRoleAll, getRoleList, updateRole };
