import { requestClient } from '#/api/request';

export namespace SystemDictItemApi {
  export interface DictItemResp {
    id: string;
    dictId: string;
    label: string;
    value: string;
    color?: string;
    sort: number;
    status: number;
    remark?: string;
    createTime: string;
  }
}

export function getDictItemList(params?: any) {
  return requestClient.get<SystemDictItemApi.DictItemResp[]>(
    '/system/dict-item/list',
    {
      params,
    },
  );
}

export function createDictItem(data: any) {
  return requestClient.post('/system/dict-item', data);
}

export function updateDictItem(id: string, data: any) {
  return requestClient.put(`/system/dict-item/${id}`, data);
}

export function deleteDictItem(id: string) {
  return requestClient.delete(`/system/dict-item/${id}`);
}
