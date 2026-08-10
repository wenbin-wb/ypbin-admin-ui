import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemFileApi {
  export interface FileQuery extends SystemCommonApi.PageQuery {
    originalName?: string;
  }

  export interface FileResp {
    bucket?: string;
    contentType?: string;
    createTime: string;
    errorMessage?: string;
    extension?: string;
    fileName: string;
    size: number;
    hash?: string;
    id: string;
    module: string;
    originalName: string;
    path?: string;
    platform?: string;
    storageStatus: string;
    url?: null | string;
  }
}

export function getFileList(params: SystemFileApi.FileQuery) {
  return requestClient.get<SystemCommonApi.PageResult<SystemFileApi.FileResp>>(
    '/system/file/list',
    { params },
  );
}

export function deleteFile(id: string) {
  return requestClient.delete(`/system/file/${id}`);
}
