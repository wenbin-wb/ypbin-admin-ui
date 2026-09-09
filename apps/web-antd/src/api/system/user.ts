import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemUserApi {
  export interface UserImportResult {
    /** 成功导入条数 */
    successCount?: number;
    /** 失败条数 */
    failCount?: number;
    /** 失败明细（行号 + 原因） */
    failList?: Array<{ errorMsg: string; rowNum: number }>;
  }

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
 * 获取用户详情
 *
 * 列表接口不回填角色/岗位（roleIds/postIds），详情接口才返回，
 * 分配角色等需要回显的场景须走详情接口取数。
 */
async function getUserDetail(id: string) {
  return requestClient.get<SystemUserApi.SystemUser>(`/system/user/${id}`);
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
 *
 * 走 requestClient.download（内部 responseReturn:'body'）而非 get + responseType:'blob'：
 * 后者沿用实例默认 responseReturn:'data'，defaultResponseInterceptor 会把 Blob 当业务响应
 * 读取其 code 字段（Blob 无 code）而误判失败；download 由拦截器直接返回 Blob。
 */
async function exportUsers(params: SystemUserApi.UserQuery) {
  return requestClient.download<Blob>('/system/user/export', { params });
}

/**
 * 下载用户导入模板
 */
async function downloadImportTemplate() {
  return requestClient.download<Blob>('/system/user/import-template');
}

/**
 * 导入用户（上传 Excel 文件）
 * @param file Excel 文件
 */
async function importUsers(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<SystemUserApi.UserImportResult>(
    '/system/user/import',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}

export {
  assignUserRoles,
  createUser,
  deleteUser,
  downloadImportTemplate,
  exportUsers,
  getUserDetail,
  getUserList,
  importUsers,
  resetUserPassword,
  updateUser,
  updateUserStatus,
};
