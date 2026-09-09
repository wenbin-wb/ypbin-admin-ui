import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

export namespace SystemLogApi {
  export interface LogQuery extends SystemCommonApi.PageQuery {
    description?: string;
    endTime?: string;
    module?: string;
    operateUserId?: string;
    startTime?: string;
    success?: number;
  }

  export interface LogResp {
    id: string;
    description?: string;
    module: string;
    requestUri: string;
    requestMethod?: string;
    ip: string;
    location?: string;
    browser?: string;
    os?: string;
    timeTaken?: number;
    success?: number;
    errorMsg?: string;
    operateUserIdName?: string;
    operateTime?: string;
    createTime: string;
  }
}

export function getLogList(params: SystemLogApi.LogQuery) {
  return requestClient.get<SystemCommonApi.PageResult<SystemLogApi.LogResp>>(
    '/system/log/list',
    { params },
  );
}

/**
 * 导出操作日志（下载 Excel 文件）
 *
 * 走 requestClient.download（内部 responseReturn:'body'）而非 get + responseType:'blob'：
 * 后者沿用实例默认 responseReturn:'data'，defaultResponseInterceptor 会把 Blob 当业务响应
 * 读取其 code 字段（Blob 无 code）而误判失败；download 由拦截器直接返回 Blob。
 */
export function exportLogs(params: SystemLogApi.LogQuery) {
  return requestClient.download<Blob>('/system/log/export', { params });
}
