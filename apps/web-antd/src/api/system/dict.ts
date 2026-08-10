import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemDictApi {
  export interface DictQuery extends SystemCommonApi.PageQuery {
    code?: string;
    name?: string;
  }

  export interface DictSaveReq {
    code: string;
    name: string;
    remark?: string;
    status?: 0 | 1;
  }

  export interface DictResp {
    id: string;
    name: string;
    code: string;
    remark?: string;
    status?: number;
    createTime: string;
    createUserName?: string;
  }
}

export function getDictList(params: SystemDictApi.DictQuery) {
  return requestClient.get<SystemCommonApi.PageResult<SystemDictApi.DictResp>>(
    '/system/dict/list',
    { params },
  );
}

export function createDict(data: SystemDictApi.DictSaveReq) {
  return requestClient.post('/system/dict', data);
}

export function updateDict(id: string, data: SystemDictApi.DictSaveReq) {
  return requestClient.put(`/system/dict/${id}`, data);
}

export function deleteDict(id: string) {
  return requestClient.delete(`/system/dict/${id}`);
}
