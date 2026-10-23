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

/**
 * 按字典编码查询字典项（下拉/标签渲染用）。
 *
 * **必须走 `/dict-item-options/{dictCode}` 而不是 `/dict-item/options/{dictCode}`**：
 * 后者所属控制器是类级 `@PlatformAccess`（仅平台用户），租户用户调用会 403 ——
 * 实测会让「空间类型」「关联对象类型」两个下拉对租户管理员完全不可用。
 * 前者是同等能力、只要求登录的只读端点。
 *
 * @param dictCode 字典编码（如 space_type）
 */
export function getDictOptions(dictCode: string) {
  return requestClient.get<{ label: string; value: string }[]>(
    `/system/dict-item-options/${dictCode}`,
  );
}
