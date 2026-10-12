import { requestClient } from '#/api/request';

export namespace SystemCommonApi {
  /** **请求**侧分页参数（由本端构造并发送，故是 `number`）。 */
  export interface PageQuery {
    page: number;
    pageSize: number;
  }

  /**
   * **响应**侧分页信封（后端 `PageResult`）。
   *
   * ⚠️ 这里刻意**不再** `extends PageQuery`：请求参数与响应字段同名不同实（一个是我们发出的
   * `number`，一个是后端回的字符串），用继承把两者捏在一起正是「类型说谎」的来源。
   *
   * 后端 `total/page/pageSize` 都是 `long`，全局 Long→字符串序列化 ⇒ 真实返回
   * `{"total":"17","page":"1","pageSize":"10"}`。消费方**必须显式转数**（如 `Number(total)`）
   * 才能参与分页计算，不允许 `as number` 把分歧藏起来。
   */
  export interface PageResult<T> {
    items: T[];
    total: number | string;
    page: number | string;
    pageSize: number | string;
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
