import { requestClient } from '#/api/request';

export namespace SystemFileApi {
  export interface FileResp {
    id: string;
    originalName: string;
    fileName: string;
    fileSize: number;
    extension: string;
    module: string;
    createTime: string;
  }
}

export function getFileList(params?: any) {
  return requestClient.get('/system/file/list', { params });
}

export function deleteFile(id: string) {
  return requestClient.delete(`/system/file/${id}`);
}
