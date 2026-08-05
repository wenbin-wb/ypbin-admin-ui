import { requestClient } from '#/api/request';

export namespace SystemOnlineUserApi {
  export interface OnlineUserResp {
    userId: string;
    username: string;
    nickname: string;
    tenantId: string;
    token: string;
    clientId: string;
    deviceType: string;
    location: string;
    browser: string;
    os: string;
    loginTime: string;
  }
}

export function getOnlineUserList(params?: any) {
  return requestClient.get<SystemOnlineUserApi.OnlineUserResp[]>(
    '/system/online-user/list',
    { params },
  );
}

export function deleteOnlineUser(token: string) {
  return requestClient.delete(`/system/online-user/${token}`);
}
