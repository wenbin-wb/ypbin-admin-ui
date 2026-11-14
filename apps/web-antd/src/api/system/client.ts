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
    /** 状态：1 启用、0 禁用 */
    status?: number;
    /** 是否已配置客户端密钥（不返回密钥本身） */
    secretConfigured?: boolean;
    /** 是否为默认客户端（禁止停用、删除、配置密钥与修改 clientId） */
    defaultClient?: boolean;
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
  // 新建默认不生成密钥，只返回客户端本身
  return requestClient.post<SystemClientApi.ClientResp>('/system/client', data);
}

export function updateClientStatus(id: string, status: number) {
  return requestClient.put(`/system/client/${id}/status`, { status });
}

export function clearClientSecret(id: string) {
  return requestClient.put(`/system/client/${id}/clear-secret`);
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
