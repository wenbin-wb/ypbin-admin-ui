import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemRoleApi {
  export interface RoleQuery extends SystemCommonApi.PageQuery {
    code?: string;
    name?: string;
    status?: 0 | 1;
  }

  export interface RoleSaveReq {
    code: string;
    dataScope?: number;
    deptIds?: string[];
    name: string;
    permissions?: string[];
    remark?: string;
    sort?: number;
    status: 0 | 1;
  }

  export interface SystemRole {
    id: string;
    name: string;
    code: string;
    dataScope?: number;
    deptIds?: string[];
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
async function getRoleList(params: SystemRoleApi.RoleQuery) {
  return requestClient.get<
    SystemCommonApi.PageResult<SystemRoleApi.SystemRole>
  >('/system/role/list', { params });
}

/**
 * 创建角色
 * @param data 角色数据
 */
async function createRole(data: SystemRoleApi.RoleSaveReq) {
  return requestClient.post('/system/role', data);
}

/**
 * 更新角色
 *
 * @param id 角色 ID
 * @param data 角色数据
 */
async function updateRole(id: string, data: SystemRoleApi.RoleSaveReq) {
  return requestClient.put(`/system/role/${id}`, data);
}

/**
 * 更新角色状态
 * @param id 角色 ID
 * @param data 状态数据
 */
async function updateRoleStatus(id: string, data: SystemCommonApi.StatusReq) {
  return requestClient.put(`/system/role/${id}/status`, data);
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
  return requestClient.get<SystemRoleApi.SystemRole[]>('/system/role/all');
}

export {
  createRole,
  deleteRole,
  getRoleAll,
  getRoleList,
  updateRole,
  updateRoleStatus,
};
