import { requestClient } from '#/api/request';

export namespace SystemCommonApi {
  /** 文件上传返回信息 */
  export interface FileInfo {
    url: string;
    originalName?: string;
    fileName?: string;
    size?: number;
    contentType?: string;
    extension?: string;
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
