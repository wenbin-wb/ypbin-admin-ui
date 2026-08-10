import { requestClient } from '#/api/request';

export namespace SystemDictItemApi {
  export interface DictItemQuery {
    dictId: string;
    label?: string;
  }

  export interface DictItemSaveReq {
    color?: string;
    dictId: string;
    label: string;
    remark?: string;
    sort: number;
    status: 0 | 1;
    value: string;
  }

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

export function getDictItemList(params: SystemDictItemApi.DictItemQuery) {
  return requestClient.get<SystemDictItemApi.DictItemResp[]>(
    '/system/dict-item/list',
    { params },
  );
}

export function createDictItem(data: SystemDictItemApi.DictItemSaveReq) {
  return requestClient.post('/system/dict-item', data);
}

export function updateDictItem(
  id: string,
  data: SystemDictItemApi.DictItemSaveReq,
) {
  return requestClient.put(`/system/dict-item/${id}`, data);
}

export function deleteDictItem(id: string) {
  return requestClient.delete(`/system/dict-item/${id}`);
}
