import { requestClient } from '#/api/request';

export namespace SystemLogApi {
  export interface LogResp {
    id: string;
    module: string;
    requestUri: string;
    ip: string;
    createTime: string;
  }
}

export function getLogList(params?: any) {
  return requestClient.get<SystemLogApi.LogResp[]>('/system/log/list', {
    params,
  });
}
