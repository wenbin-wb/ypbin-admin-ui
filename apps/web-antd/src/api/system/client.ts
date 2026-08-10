import { requestClient } from '#/api/request';

export namespace SystemClientApi {
  export interface ClientSaveReq {
    activeTimeout?: number;
    authTypes?: string;
    clientId: string;
    clientType: string;
    concurrentEnabled?: number;
    maxLoginCount?: number;
    remark?: string;
    timeout?: number;
  }

  export interface ClientResp {
    id: string;
    clientId: string;
    clientType: string;
    authTypes?: string;
    timeout?: number;
    activeTimeout?: number;
    concurrentEnabled?: number;
    maxLoginCount?: number;
    remark?: string;
    createTime: string;
  }

  export interface ClientCredentialResp {
    clientId: string;
    clientSecret: string;
  }
}

export function getClientList() {
  return requestClient.get<SystemClientApi.ClientResp[]>('/system/client/list');
}

export function createClient(data: SystemClientApi.ClientSaveReq) {
  return requestClient.post<SystemClientApi.ClientCredentialResp>(
    '/system/client',
    data,
  );
}

export function updateClient(id: string, data: SystemClientApi.ClientSaveReq) {
  return requestClient.put(`/system/client/${id}`, data);
}

export function deleteClient(id: string) {
  return requestClient.delete(`/system/client/${id}`);
}

export function resetClientSecret(id: string) {
  return requestClient.put<SystemClientApi.ClientCredentialResp>(
    `/system/client/${id}/reset-secret`,
  );
}
