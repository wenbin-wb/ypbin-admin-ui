import { requestClient } from '#/api/request';

export namespace SystemCommonApi {
  export interface PageQuery {
    page: number;
    pageSize: number;
  }

  export interface PageResult<T> extends PageQuery {
    items: T[];
    total: number;
  }

  export interface StatusReq {
    status: 0 | 1;
  }

  /** 文件上传返回信息 */
  export interface FileInfo {
    bucket: string;
    contentType?: string;
    createTime: string;
    extension?: string;
    fileName: string;
    hash?: string;
    originalName: string;
    path: string;
    platform: string;
    size: number;
    thumbnailUrl?: null | string;
    url?: null | string;
  }
}

/**
 * 上传文件到指定业务模块目录，返回文件信息（含可访问 url）。
 * @param file 文件对象
 * @param module 业务模块（如 notice、avatar），用于存储分目录
 */
export function uploadFile(file: File, module = 'default') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('module', module);
  return requestClient.post<SystemCommonApi.FileInfo>(
    '/system/file/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}
