import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemUserApi {
  export interface SystemUser {
    [key: string]: any;
    id: string;
    username: string;
    password?: string;
    realName: string;
    nickname?: string;
    deptId?: string;
    deptIdName?: string;
    deptIdText?: string;
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
async function getUserList(params: Recordable<any>) {
  return requestClient.get<Array<SystemUserApi.SystemUser>>(
    '/system/user/list',
    { params },
  );
}

/**
 * 创建用户
 * @param data 用户数据
 */
async function createUser(data: Omit<SystemUserApi.SystemUser, 'id'>) {
  return requestClient.post('/system/user', data);
}

/**
 * 更新用户
 *
 * @param id 用户 ID
 * @param data 用户数据
 */
async function updateUser(
  id: string,
  data: Omit<SystemUserApi.SystemUser, 'id'>,
) {
  return requestClient.put(`/system/user/${id}`, data);
}

/**
 * 删除用户
 * @param id 用户 ID
 */
async function deleteUser(id: string) {
  return requestClient.delete(`/system/user/${id}`);
}

/**
 * 获取所有岗位（下拉用）
 */
async function getPostList() {
  return requestClient.get<Array<any>>('/system/post/list');
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

export {
  assignUserRoles,
  createUser,
  deleteUser,
  getPostList,
  getUserList,
  resetUserPassword,
  updateUser,
};
