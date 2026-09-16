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

  /**
   * 漏斗单步结果。
   *
   * `conversionRate` 是后端算好的**相对首步**转化率（0~1，首步为 1）；
   * 首步会话数为 0 时后端返回 null（分母缺失，不伪造成 0）。「较上一步」的转化率后端不给，
   * 由前端按相邻两步的 sessionCount 现算。
   */
  export interface TrackFunnelStep {
    /** 步骤序号（从 1 开始） */
    stepIndex: number;
    eventCode: string;
    /** 走到本步的会话数（Long，字符串传输） */
    sessionCount: string;
    /** 相对首步的转化率（0~1，字符串传输；分母缺失时为 null） */
    conversionRate: null | string;
  }

  /**
   * 漏斗分析结果。
   *
   * 注意 `data` 是**对象**不是数组；`steps` 才是数组。
   */
  export interface TrackFunnel {
    /** 各步骤结果（按请求的步骤顺序） */
    steps: TrackFunnelStep[];
    /**
     * 事件序列被截断的会话数（Long，字符串传输）。
     *
     * 大于 0 时各步 sessionCount 只是**下限**：被截断的会话可能丢失了后续步骤。
     */
    truncatedSessionCount: string;
  }

  /** 留存矩阵单元 */
  export interface TrackRetentionCell {
    /** 相对首次出现日的天数偏移（0 为首次出现当日） */
    dayOffset: number;
    /** 该偏移日再次出现的去重用户数（Long，字符串传输） */
    userCount: string;
    /** 留存率（0~1，字符串传输；该行基数为 0 时为 null） */
    retentionRate: null | string;
  }

  /** 留存矩阵的一行（一个「首次出现日」） */
  export interface TrackRetentionRow {
    /** 首次出现日（yyyy-MM-dd） */
    cohortDate: string;
    /** 该日首次出现的去重用户数（D0 基数，Long 按字符串传输） */
    cohortSize: string;
    /** 各偏移日的留存单元（长度等于 matrixDays） */
    cells: TrackRetentionCell[];
  }

  /** 留存摘要列（D1/D7/D30 中本次窗口内可观察的那些） */
  export interface TrackRetentionSummary {
    dayOffset: number;
    /** 参与统计的首次出现用户数之和（分母，Long 按字符串传输） */
    cohortSize: string;
    /** 该偏移日再次出现的去重用户数之和（分子，Long 按字符串传输） */
    userCount: string;
    /** 加权留存率（0~1，字符串传输；分母为 0 时为 null） */
    retentionRate: null | string;
  }

  /**
   * 留存分析结果：完整矩阵 + 摘要列。
   *
   * 只覆盖登录用户（匿名事件没有 user_id，不进留存）；
   * 矩阵是 `matrixDays × matrixDays` 的完整网格（当前 `matrixDays = min(days, 7)`）。
   */
  export interface TrackRetention {
    /** 请求的分析天数 */
    days: number;
    /** 矩阵网格边长（行数 = 列数） */
    matrixDays: number;
    /** 矩阵行的首次出现日（升序，yyyy-MM-dd） */
    cohortDates: string[];
    /** 矩阵列的偏移日（升序，0..matrixDays-1） */
    dayOffsets: number[];
    rows: TrackRetentionRow[];
    summary: TrackRetentionSummary[];
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
/**
 * 会话级漏斗分析
 *
 * @param steps 逗号分隔的事件码（2..8 个，按会话内发生顺序）
 * @param days 统计天数（1..90）
 */
export function getTrackFunnel(steps: string, days: number) {
  return requestClient.get<SystemTrackingApi.TrackFunnel>(
    '/system/tracking/funnel',
    { params: { days, steps } },
  );
}

/**
 * 用户留存矩阵与摘要
 *
 * @param days 分析天数（1..90；30 才有 D30 摘要，矩阵固定最长 7×7）
 */
export function getTrackRetention(days: number) {
  return requestClient.get<SystemTrackingApi.TrackRetention>(
    '/system/tracking/retention',
    { params: { days } },
  );
}

export function exportTrackEvents(params: SystemTrackingApi.TrackEventQuery) {
  return requestClient.download<Blob>('/system/tracking/events/export', {
    params,
  });
}
