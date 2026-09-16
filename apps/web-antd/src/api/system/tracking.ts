import type { SystemCommonApi } from './common';

import { requestClient } from '#/api/request';

/**
 * 埋点查询接口（后端 `TrackEventController`，网关前缀 `/api`）。
 *
 * 类型字段与后端 DTO 全程同名（Long 由全局序列化转字符串输出），不做任何改名映射。
 */
export namespace SystemTrackingApi {
  /** 事件明细分页查询条件 */
  export interface TrackEventQuery extends SystemCommonApi.PageQuery {
    /** 应用标识（精确匹配） */
    appId?: string;
    /** 结束时间（yyyy-MM-dd HH:mm:ss，按服务端接收时间过滤） */
    endTime?: string;
    /** 事件码（精确匹配） */
    eventCode?: string;
    /** 会话 ID（精确匹配） */
    sessionId?: string;
    /** 起始时间（yyyy-MM-dd HH:mm:ss，按服务端接收时间过滤） */
    startTime?: string;
    /** 结果：1 成功、0 失败 */
    success?: number;
    /** 链路 ID（精确匹配） */
    traceId?: string;
    /** 用户 ID（Long，字符串传输） */
    userId?: string;
  }

  /** 埋点事件明细 */
  export interface TrackEvent {
    id: string;
    eventId: string;
    eventCode: string;
    appId: string;
    userId?: string;
    /** 用户展示名：后端 `@RefText` 派生字段，未接入引用翻译时不输出 */
    userIdName?: string;
    sessionId?: string;
    anonId?: string;
    traceId?: string;
    eventTime?: string;
    receivedTime?: string;
    pageUrl?: string;
    referrer?: string;
    ip?: string;
    userAgent?: string;
    /** 耗时（毫秒，Long 按字符串传输） */
    durationMs?: string;
    /** 结果：1 成功、0 失败 */
    success?: number;
    /** 事件属性（白名单内的键，值为原始类型） */
    payload?: Record<string, unknown>;
  }

  /** 概览统计（计数均为 Long，按字符串传输） */
  export interface TrackOverview {
    totalEvents: string;
    todayEvents: string;
    weekEvents: string;
    weekUsers: string;
    weekFailures: string;
  }

  /** 趋势点（后端已按天补零，日期连续） */
  export interface TrackTrend {
    /** 日期（yyyy-MM-dd） */
    date: string;
    count: string;
  }

  /** Top 事件（只有事件码，中文描述由前端按事件目录映射） */
  export interface TrackTopEvent {
    eventCode: string;
    /** 次数（Long，字符串传输） */
    count: string;
  }

  /** 应用维度计数（appId 可能为空，表示上报方未带应用标识） */
  export interface TrackAppCount {
    appId?: string;
    /** 次数（Long，字符串传输） */
    count: string;
  }
}

/** 概览统计 */
export function getTrackOverview() {
  return requestClient.get<SystemTrackingApi.TrackOverview>(
    '/system/tracking/overview',
  );
}

/**
 * 事件趋势（连续日期序列）
 * @param days 统计天数（1..90）
 */
export function getTrackTrend(days: number) {
  return requestClient.get<SystemTrackingApi.TrackTrend[]>(
    '/system/tracking/events/trend',
    { params: { days } },
  );
}

/**
 * Top 事件排行（按次数降序）
 * @param days 统计天数（1..90）
 * @param limit 返回条数（1..50）
 */
export function getTrackTopEvents(days: number, limit: number) {
  return requestClient.get<SystemTrackingApi.TrackTopEvent[]>(
    '/system/tracking/events/top',
    { params: { days, limit } },
  );
}

/**
 * 应用维度分布（按次数降序）
 * @param days 统计天数（1..90）
 */
export function getTrackAppDistribution(days: number) {
  return requestClient.get<SystemTrackingApi.TrackAppCount[]>(
    '/system/tracking/apps/distribution',
    { params: { days } },
  );
}

/** 事件明细分页列表 */
export function getTrackEventList(params: SystemTrackingApi.TrackEventQuery) {
  return requestClient.get<
    SystemCommonApi.PageResult<SystemTrackingApi.TrackEvent>
  >('/system/tracking/events/list', { params });
}

/**
 * 导出事件明细（下载 Excel 文件，超过 2 万条后端返回业务错误）
 *
 * 走 requestClient.download（内部 responseReturn:'body'）而非 get + responseType:'blob'：
 * 后者沿用实例默认 responseReturn:'data'，defaultResponseInterceptor 会把 Blob 当业务响应
 * 读取其 code 字段（Blob 无 code）而误判失败；download 由拦截器直接返回 Blob。
 */
export function exportTrackEvents(params: SystemTrackingApi.TrackEventQuery) {
  return requestClient.download<Blob>('/system/tracking/events/export', {
    params,
  });
}
