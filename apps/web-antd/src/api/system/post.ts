import { requestClient } from '#/api/request';

export namespace SystemPostApi {
  export interface PostSaveReq {
    category?: string;
    code: string;
    name: string;
    remark?: string;
    sort: number;
    status: 0 | 1;
  }

  export interface PostResp {
    id: string;
    name: string;
    code: string;
    category: string;
    sort: number;
    remark: string;
    status: number;
    createTime: string;
    /**
     * 工作地点展示文本（前端派生，**后端不返回**）。
     *
     * 由列表查询时的一次批量反查填充；主空间路径 + 「+N」表示还有几个其它空间。
     */
    spaceText?: string;
  }
}

export function getPostList() {
  return requestClient.get<SystemPostApi.PostResp[]>('/system/post/list');
}

/**
 * 创建岗位。
 *
 * 后端返回**新岗位 ID**（不是 void）——前端新建后要立即绑定「工作地点（空间）」，
 * 拿不到 ID 就只能静默丢弃用户选的空间。
 */
export function createPost(data: SystemPostApi.PostSaveReq) {
  return requestClient.post<string>('/system/post', data);
}

export function updatePost(id: string, data: SystemPostApi.PostSaveReq) {
  return requestClient.put(`/system/post/${id}`, data);
}

export function deletePost(id: string) {
  return requestClient.delete(`/system/post/${id}`);
}
