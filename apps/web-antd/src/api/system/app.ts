import { requestClient } from '#/api/request';

export namespace SystemAppApi {
  export interface AppResp {
    id: string;
    appName: string;
    accessKey: string;
    expireTime?: string;
    enabled: number;
    createTime: string;
  }

  export interface AppCredentialResp {
    accessKey: string;
    secretKey: string;
  }

  export interface AppSaveReq {
    appName: string;
    enabled: number;
    expireTime?: string;
  }
}

export function getAppList() {
  return requestClient.get<SystemAppApi.AppResp[]>('/system/app/list');
}

export function createApp(data: SystemAppApi.AppSaveReq) {
  return requestClient.post<SystemAppApi.AppCredentialResp>(
    '/system/app',
    data,
  );
}

export function updateApp(id: string, data: SystemAppApi.AppSaveReq) {
  return requestClient.put(`/system/app/${id}`, data);
}

export function deleteApp(id: string) {
  return requestClient.delete(`/system/app/${id}`);
}

export function resetAppSecret(id: string) {
  return requestClient.put<SystemAppApi.AppCredentialResp>(
    `/system/app/${id}/reset-secret`,
  );
}
