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
  }
}

export function getPostList() {
  return requestClient.get<SystemPostApi.PostResp[]>('/system/post/list');
}

export function createPost(data: SystemPostApi.PostSaveReq) {
  return requestClient.post('/system/post', data);
}

export function updatePost(id: string, data: SystemPostApi.PostSaveReq) {
  return requestClient.put(`/system/post/${id}`, data);
}

export function deletePost(id: string) {
  return requestClient.delete(`/system/post/${id}`);
}
