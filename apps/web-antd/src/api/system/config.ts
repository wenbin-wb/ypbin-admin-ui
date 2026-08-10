import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemConfigApi {
  export interface ConfigQuery extends SystemCommonApi.PageQuery {
    builtIn?: 0 | 1;
    configGroup?: string;
    configKey?: string;
    name?: string;
  }

  export interface ConfigSaveReq {
    configGroup: string;
    configKey: string;
    configValue: string;
    name?: string;
    remark?: string;
  }

  export interface ConfigResp {
    id: string;
    configGroup: string;
    name?: string;
    configKey: string;
    configValue: string;
    builtIn?: number;
    remark?: string;
    createUser?: string;
    createUserName?: string;
    updateTime: string;
  }

  export interface ConfigUpdateBatchReq {
    configs: Record<string, string>;
  }

  export type SocialSource =
    | 'alipay'
    | 'dingtalk'
    | 'gitee'
    | 'github'
    | 'qq'
    | 'wechat_open';

  export interface SocialConfigResp {
    clientId: string;
    clientSecretConfigured: boolean;
    enabled: boolean;
    publicKey: string;
    redirectUri: string;
    source: SocialSource;
  }

  export interface SocialConfigUpdateReq {
    clientId: string;
    clientSecret: string;
    enabled: boolean;
    publicKey: string;
    redirectUri: string;
  }
}

export function getConfigList(params: SystemConfigApi.ConfigQuery) {
  return requestClient.get<
    SystemCommonApi.PageResult<SystemConfigApi.ConfigResp>
  >('/system/config/list', { params });
}

export function getConfigGroup(configGroup: string) {
  return requestClient.get<SystemConfigApi.ConfigResp[]>(
    `/system/config/group/${configGroup}`,
  );
}

export function createConfig(data: SystemConfigApi.ConfigSaveReq) {
  return requestClient.post('/system/config', data);
}

export function updateConfig(id: string, data: SystemConfigApi.ConfigSaveReq) {
  return requestClient.put(`/system/config/${id}`, data);
}

export function updateConfigBatch(
  configGroup: string,
  configs: Record<string, string>,
) {
  return requestClient.put(`/system/config/group/${configGroup}`, { configs });
}

export function getSocialConfigList() {
  return requestClient.get<SystemConfigApi.SocialConfigResp[]>(
    '/system/config/social',
  );
}

export function getSocialConfigDetail(source: SystemConfigApi.SocialSource) {
  return requestClient.get<SystemConfigApi.SocialConfigResp>(
    `/system/config/social/${source}`,
  );
}

export function updateSocialConfig(
  source: SystemConfigApi.SocialSource,
  data: SystemConfigApi.SocialConfigUpdateReq,
) {
  return requestClient.put(`/system/config/social/${source}`, data);
}

export function deleteConfig(id: string) {
  return requestClient.delete(`/system/config/${id}`);
}
