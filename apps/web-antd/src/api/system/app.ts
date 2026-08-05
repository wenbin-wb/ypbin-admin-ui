import { requestClient } from '#/api/request';

export namespace SystemAppApi {
  export interface AppResp {
    id: string;
    appName: string;
    accessKey: string;
    secretKey: string;
    expireTime: string;
    enabled: number;
    createTime: string;
  }
}

export function getAppList(params?: any) {
  return requestClient.get('/system/app/list', { params });
}

export function createApp(data: any) {
  return requestClient.post<string>('/system/app', data);
}

export function updateApp(id: string, data: any) {
  return requestClient.put(`/system/app/${id}`, data);
}

export function deleteApp(id: string) {
  return requestClient.delete(`/system/app/${id}`);
}

export function resetAppSecret(id: string) {
  return requestClient.put<string>(`/system/app/${id}/reset-secret`);
}
