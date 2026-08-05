import { requestClient } from '#/api/request';

export namespace SystemDictApi {
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

export function getDictList(params?: any) {
  return requestClient.get<SystemDictApi.DictResp[]>('/system/dict/list', {
    params,
  });
}

export function createDict(data: any) {
  return requestClient.post('/system/dict', data);
}

export function updateDict(id: string, data: any) {
  return requestClient.put(`/system/dict/${id}`, data);
}

export function deleteDict(id: string) {
  return requestClient.delete(`/system/dict/${id}`);
}
