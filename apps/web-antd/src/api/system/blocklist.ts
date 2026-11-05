import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemBlocklistApi {
  export type MatchType = 'CIDR' | 'IP' | 'PATH' | 'USER_AGENT';

  export interface BlocklistQuery extends SystemCommonApi.PageQuery {
    matchType?: MatchType;
    matchValue?: string;
    status?: 0 | 1;
  }

  export interface BlocklistSaveReq {
    expireTime?: string;
    matchType: MatchType;
    matchValue: string;
    reason?: string;
    status?: 0 | 1;
  }

  export interface BlocklistResp {
    createTime: string;
    expireTime?: string;
    id: string;
    matchType: MatchType;
    matchValue: string;
    reason?: string;
    status: 0 | 1;
    updateTime?: string;
  }

  export interface AutoBanResp {
    clientIp: string;
    /** 对应 starter AutoBanEntry.expireAt */
    expireTime: string;
    reason?: string;
  }

  export interface BlocklistBanReq {
    banSeconds: number;
    clientIp: string;
    reason?: string;
  }
}

export function getBlocklistList(params: SystemBlocklistApi.BlocklistQuery) {
  return requestClient.get<
    SystemCommonApi.PageResult<SystemBlocklistApi.BlocklistResp>
  >('/system/security/blocklist/list', { params });
}

export function createBlocklist(data: SystemBlocklistApi.BlocklistSaveReq) {
  return requestClient.post('/system/security/blocklist', data);
}

export function updateBlocklist(
  id: string,
  data: SystemBlocklistApi.BlocklistSaveReq,
) {
  return requestClient.put(`/system/security/blocklist/${id}`, data);
}

export function deleteBlocklist(id: string) {
  return requestClient.delete(`/system/security/blocklist/${id}`);
}

export function getAutoBans() {
  return requestClient.get<SystemBlocklistApi.AutoBanResp[]>(
    '/system/security/blocklist/auto-ban',
  );
}

export function banBlocklistIp(data: SystemBlocklistApi.BlocklistBanReq) {
  return requestClient.post('/system/security/blocklist/ban', data);
}

export function unbanAuto(clientIp: string) {
  return requestClient.delete(
    `/system/security/blocklist/auto-ban/${encodeURIComponent(clientIp)}`,
  );
}

export function refreshBlocklist() {
  return requestClient.post('/system/security/blocklist/refresh');
}
