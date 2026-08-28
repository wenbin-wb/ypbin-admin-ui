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
 */
export function exportLogs(params: SystemLogApi.LogQuery) {
  return requestClient.get('/system/log/export', {
    params,
    responseType: 'blob',
  });
}
