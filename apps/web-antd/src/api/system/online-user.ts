import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemOnlineUserApi {
  export interface OnlineUserQuery extends SystemCommonApi.PageQuery {
    keyword?: string;
  }

  export interface OnlineUserResp {
    userId: string;
    username: string;
    nickname: string;
    realName: string;
    tenantId: string;
    token: string;
    clientId: string;
    deviceType: string;
    ip: string;
    location: string;
    browser: string;
    os: string;
    loginTime: string;
  }
}

/**
 * 获取在线用户分页列表。
 *
 * 后端为**内存分页**（先枚举全部在线会话再切片）：`total` 是真实总数，越界页返回空 `items`。
 */
export function getOnlineUserList(params: SystemOnlineUserApi.OnlineUserQuery) {
  return requestClient.get<
    SystemCommonApi.PageResult<SystemOnlineUserApi.OnlineUserResp>
  >('/system/online-user/list', { params });
}

export function deleteOnlineUser(token: string) {
  return requestClient.delete(`/system/online-user/${token}`);
}
