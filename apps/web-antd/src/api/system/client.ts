import { requestClient } from '#/api/request';

export namespace SystemClientApi {
  export interface ClientResp {
    id: string;
    clientId: string;
    clientSecret: string;
    clientType: string;
    createTime: string;
  }
}

export function getClientList(params?: any) {
  return requestClient.get<SystemClientApi.ClientResp[]>(
    '/system/client/list',
    { params },
  );
}

export function createClient(data: any) {
  return requestClient.post<string>('/system/client', data);
}

export function updateClient(id: string, data: any) {
  return requestClient.put(`/system/client/${id}`, data);
}

export function deleteClient(id: string) {
  return requestClient.delete(`/system/client/${id}`);
}

export function resetClientSecret(id: string) {
  return requestClient.put<string>(`/system/client/${id}/reset-secret`);
}
