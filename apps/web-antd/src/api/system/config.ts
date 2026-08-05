import { requestClient } from '#/api/request';

export namespace SystemConfigApi {
  export interface ConfigResp {
    id: string;
    configGroup: string;
    configKey: string;
    configValue: string;
    createTime: string;
    createUserName?: string;
  }
}

export function getConfigList(params?: any) {
  return requestClient.get<SystemConfigApi.ConfigResp[]>(
    '/system/config/list',
    { params },
  );
}

export function createConfig(data: any) {
  return requestClient.post('/system/config', data);
}

export function updateConfig(id: string, data: any) {
  return requestClient.put(`/system/config/${id}`, data);
}

export function deleteConfig(id: string) {
  return requestClient.delete(`/system/config/${id}`);
}
