import { requestClient } from '#/api/request';

export namespace SystemLogApi {
  export interface LogResp {
    id: string;
    description?: string;
    module: string;
    requestUri: string;
    requestMethod?: string;
    ip: string;
    location?: string;
    browser?: string;
    os?: string;
    timeTaken?: number;
    success?: number;
    errorMsg?: string;
    operateUserIdName?: string;
    operateTime?: string;
    createTime: string;
  }
}

export function getLogList(params?: any) {
  return requestClient.get<SystemLogApi.LogResp[]>('/system/log/list', {
    params,
  });
}
