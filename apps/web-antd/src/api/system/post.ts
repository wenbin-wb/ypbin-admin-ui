import { requestClient } from '#/api/request';

export namespace SystemPostApi {
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

export function createPost(data: any) {
  return requestClient.post('/system/post', data);
}

export function updatePost(id: string, data: any) {
  return requestClient.put(`/system/post/${id}`, data);
}

export function deletePost(id: string) {
  return requestClient.delete(`/system/post/${id}`);
}
