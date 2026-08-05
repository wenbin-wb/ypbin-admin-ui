import { requestClient } from '#/api/request';

export namespace DashboardApi {
  /** 系统概览计数 */
  export interface Stats {
    userCount: number;
    roleCount: number;
    deptCount: number;
    menuCount: number;
    onlineCount: number;
    logCount: number;
  }

  /** 最新动态（操作日志）——字段对齐后端 LogResp */
  export interface LatestLog {
    id: string;
    description: string;
    module: string;
    operateUserId: string;
    operateUserIdName?: string;
    operateTime: string;
    success: number;
    ip?: string;
  }

  /** 操作日志按天趋势 */
  export interface LogTrend {
    date: string;
    count: number;
  }
}

/**
 * 获取系统概览计数
 */
async function getDashboardStats() {
  return requestClient.get<DashboardApi.Stats>('/dashboard/stats');
}

/**
 * 获取最新动态（最近若干条操作日志）
 * @param limit 条数，默认 10
 */
async function getLatestLogs(limit = 10) {
  return requestClient.get<DashboardApi.LatestLog[]>('/dashboard/latest-logs', {
    params: { limit },
  });
}

/**
 * 获取操作日志趋势（近若干天按天聚合）
 * @param days 天数，默认 7
 */
async function getLogTrend(days = 7) {
  return requestClient.get<DashboardApi.LogTrend[]>('/dashboard/log-trend', {
    params: { days },
  });
}

export { getDashboardStats, getLatestLogs, getLogTrend };
