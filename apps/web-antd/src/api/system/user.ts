import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemUserApi {
  export interface UserQuery extends SystemCommonApi.PageQuery {
    deptId?: string;
    phone?: string;
    realName?: string;
    status?: 0 | 1;
    username?: string;
  }

  export interface UserSaveReq {
    avatar?: string;
    deptId?: string;
    email?: string;
    gender?: 0 | 1 | 2;
    nickname?: string;
    password?: string;
    phone?: string;
    postIds?: string[];
    realName: string;
    remark?: string;
    roleIds?: string[];
    status: 0 | 1;
    username: string;
  }

  export interface SystemUser {
    id: string;
    username: string;
    password?: string;
    realName: string;
    nickname?: string;
    deptId?: string;
    deptIdName?: string;
    avatar?: string;
    phone?: string;
    email?: string;
    gender?: 0 | 1 | 2;
    genderText?: string;
    status: 0 | 1;
    statusText?: string;
    remark?: string;
    roleIds?: string[];
    postIds?: string[];
    createUser?: string;
    createUserName?: string;
    lastLoginTime?: string;
    createTime?: string;
  }
}

/**
 * 获取用户列表数据
 */
async function getUserList(params: SystemUserApi.UserQuery) {
  return requestClient.get<
    SystemCommonApi.PageResult<SystemUserApi.SystemUser>
  >('/system/user/list', { params });
}

/**
 * 创建用户
 * @param data 用户数据
 */
async function createUser(data: SystemUserApi.UserSaveReq) {
  return requestClient.post('/system/user', data);
}

/**
 * 更新用户
 *
 * @param id 用户 ID
 * @param data 用户数据
 */
async function updateUser(id: string, data: SystemUserApi.UserSaveReq) {
  return requestClient.put(`/system/user/${id}`, data);
}

/**
 * 更新用户状态
 * @param id 用户 ID
 * @param data 状态数据
 */
async function updateUserStatus(id: string, data: SystemCommonApi.StatusReq) {
  return requestClient.put(`/system/user/${id}/status`, data);
}

/**
 * 删除用户
 * @param id 用户 ID
 */
async function deleteUser(id: string) {
  return requestClient.delete(`/system/user/${id}`);
}

/**
 * 重置用户密码（管理员操作）
 * @param id 用户 ID
 * @param password 新密码
 */
async function resetUserPassword(id: string, password: string) {
  return requestClient.put(`/system/user/${id}/reset-password`, { password });
}

/**
 * 分配用户角色（覆盖式重设）
 * @param id 用户 ID
 * @param roleIds 角色 ID 集合
 */
async function assignUserRoles(id: string, roleIds: string[]) {
  return requestClient.put(`/system/user/${id}/roles`, { roleIds });
}

/**
 * 导出用户列表（下载 Excel 文件）
 */
async function exportUsers(params: SystemUserApi.UserQuery) {
  return requestClient.post('/system/user/export', params, {
    responseType: 'blob',
  });
}

/**
 * 下载用户导入模板
 */
async function downloadImportTemplate() {
  return requestClient.get('/system/user/import-template', {
    responseType: 'blob',
  });
}

/**
 * 导入用户（上传 Excel 文件）
 * @param file Excel 文件
 */
async function importUsers(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post('/system/user/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export {
  assignUserRoles,
  createUser,
  deleteUser,
  exportUsers,
  downloadImportTemplate,
  importUsers,
  getUserList,
  resetUserPassword,
  updateUser,
  updateUserStatus,
};
