import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemPlatformUserApi {
  export interface PlatformUser {
    id: string;
    username: string;
    /** 姓名，后端允许 NULL */
    realName: null | string;
    nickname?: null | string;
    /** 状态：1 启用、0 禁用 */
    status: 0 | 1;
    lastLoginTime?: string;
    createTime?: string;
  }

  export interface PlatformUserQuery extends SystemCommonApi.PageQuery {
    realName?: string;
    status?: 0 | 1;
    username?: string;
  }
}

/** 平台账号分页列表 */
async function getPlatformUserList(
  params: SystemPlatformUserApi.PlatformUserQuery,
) {
  return requestClient.get<{
    items: SystemPlatformUserApi.PlatformUser[];
    total: number;
  }>('/system/platform-user/list', { params });
}

/** 修改平台账号状态 */
async function updatePlatformUserStatus(id: string, data: { status: 0 | 1 }) {
  return requestClient.put(`/system/platform-user/${id}/status`, data);
}

/** 重置平台账号密码 */
async function resetPlatformUserPassword(id: string, password: string) {
  return requestClient.put(`/system/platform-user/${id}/reset-password`, {
    password,
  });
}

export {
  getPlatformUserList,
  resetPlatformUserPassword,
  updatePlatformUserStatus,
};
