/**
 * 埋点 SDK 的对外类型。
 *
 * 与后端契约（ypbin-starter 的 `ypbin-starter-tracking`）一一对应：字段名全程同名，
 * 不做任何字段改名映射；事件码必须取自 `events.generated.ts`（由事件目录生成）。
 */

/**
 * 宿主对象只按**最小结构**接收，而不是 import vue / vue-router 的类型，原因有两条：
 *
 * 1. 本包零运行时依赖，宿主用什么版本的 vue / vue-router 与本包无关；
 * 2. 工作区内若解析出两份 vue-router（不同 peer 组合），直接引用其类型会因
 *    「同一类型两个副本」而无法互相赋值——本仓库踩过同类问题（tiptap/prosemirror-view），
 *    这里从源头避开。
 */
export interface TrackableRoute {
  /** 路由元信息；只取用到的字段，类型交给调用方收窄 */
  meta?: unknown;
  /** 路由路径 */
  path: string;
}

export interface TrackableRouter {
  /** 注册导航后置钩子（与 vue-router 的 afterEach 结构兼容） */
  afterEach: (
    hook: (to: TrackableRoute, from: unknown, failure?: unknown) => void,
  ) => unknown;
}

/** 全局错误处理函数签名（与 Vue 的 app.config.errorHandler 结构兼容） */
export type TrackableErrorHandler = (
  error: unknown,
  instance: unknown,
  info: string,
) => void;

export interface TrackableApp {
  config: {
    errorHandler?: unknown;
  };
}

/** 上报选项；`initTracking` 的默认值见 `DEFAULT_TRACKING_OPTIONS` */
export interface TrackingOptions {
  /** 应用标识，随事件上报（后端按目录校验维度，超长会被截断） */
  appId: string;
  /** 单批事件数上限（服务端另有 max-events-per-request，取值不得超过服务端上限） */
  batchSize: number;
  /** 是否启用（false 时 SDK 完全不安装采集器，只打印一条提示） */
  enabled: boolean;
  /** 定时刷新间隔（毫秒） */
  flushIntervalMs: number;
  /**
   * 取当前访问令牌的回调；返回空表示**匿名上报**（这是允许的，且不得因此失败）。
   *
   * 刻意用回调而不是初始化时传入令牌字符串：令牌会在登录 / 登出 / 过期时变化，
   * 初始化只取一次会把过期令牌一直用下去。也刻意不让本包去 import 应用侧的
   * store / hooks——本包零依赖，取值口径由宿主自行接线（应与业务请求客户端同源）。
   */
  getToken?: () => string | undefined;
  /**
   * 接口慢调用阈值（毫秒）：只有**失败**或**耗时达到该阈值**的接口调用才会上报。
   *
   * 刻意不做"每次接口调用都上报"——那会让事件量翻十倍以上，而这类数据的分析价值主要集中在
   * 异常与变慢上。设为 0 表示上报全部调用（仅建议在排查问题时临时开启）。
   */
  slowApiThresholdMs: number;
  /** 上报接口地址；为空表示不启用（刻意不静默：会打印告警） */
  url: string;
}

/** 单条事件的公共上下文；由采集器填充，业务无需关心 */
export interface TrackEventInput {
  /** 事件码，必须取自 `TrackingEventCodes` */
  eventCode: string;
  /** 耗时毫秒（停留 / 接口 / 采集） */
  durationMs?: number;
  /** 页面地址（SDK 已去除查询串） */
  pageUrl?: string;
  /** 事件属性，键必须在事件目录的白名单内，否则服务端会拒绝该键 */
  payload?: Record<string, unknown>;
  /**
   * 来源；**仅供 SDK 内部为 `ui.page.view` 填入「本页的来源」**，业务与采集器无需传。
   *
   * 缺省时由 SDK 用 `currentPageReferrer()` 补齐（进入本页时解析并冻结的值），
   * 故显式传空串表示「本次确实没有来源」，与「没传」不是一回事；写入事件体前统一截断。
   */
  referrer?: string;
  /** 结果是否成功 */
  success?: boolean;
}

/** 上报给后端的单条事件（与后端 `TrackIngestEvent` 同名字段） */
export interface TrackEventBody {
  anonId: string;
  appId: string;
  durationMs?: number;
  eventCode: string;
  eventId: string;
  eventTime: string;
  pageUrl?: string;
  payload: Record<string, unknown>;
  referrer?: string;
  sessionId: string;
  success?: boolean;
}

/** 后端返回的逐项计数（HTTP 200 + R 结构里的 data） */
export interface TrackIngestResult {
  accepted: number;
  dropped: number;
  reasons: Record<string, number>;
  received: number;
  rejected: number;
}

/** `reportApiCall` 的入参：接口耗时与结果 */
export interface ApiCallInput {
  /** 业务响应码（与后端 R.code 对齐） */
  bizCode?: number;
  /** 耗时毫秒 */
  durationMs: number;
  /** HTTP 方法 */
  httpMethod: string;
  /** 接口路径（SDK 会去除查询串） */
  path: string;
  /** 业务是否成功（按后端约定：code === 200） */
  success: boolean;
}

/** `initTracking` 的返回值，便于测试与手动刷新 */
export interface TrackingHandle {
  /** 立即清空队列并上报 */
  flush: () => Promise<void>;
  /** 停止采集（移除监听、停止定时器）；调用后不可恢复 */
  stop: () => void;
}
