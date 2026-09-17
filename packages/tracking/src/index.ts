/**
 * 埋点 SDK 入口。
 *
 * 用法（在应用启动流程里调用一次即可）：
 * ```ts
 * initTracking(app, router, { appId: 'ypbin-admin-ui', url: trackURL });
 * ```
 *
 * 与后端 `ypbin-starter-tracking` 的对应关系：
 * - 事件码取自 `events.generated.ts`（由 `scripts/sync-tracking-events.mjs` 从 starter 的事件目录生成）；
 * - 请求体字段与后端 `TrackIngestEvent` 同名，不做任何改名映射；
 * - 上报走**独立通道**（直接 `fetch`/`sendBeacon`），不复用业务请求客户端——
 *   避免全局 loading、错误弹窗与 401 刷新逻辑互相干扰；
 * - 身份由宿主通过 `getToken` 回调提供（取值口径须与业务请求客户端**同源**），
 *   本包不 import 任何应用侧 store；取不到令牌即匿名上报，不影响上报本身的可用性。
 */
import {
  installClickCollector,
  installErrorCollector,
  installPageCollector,
  installVitalsCollector,
} from './collectors';
import {
  currentAnonId,
  currentPageUrl,
  currentReferrer,
  currentSessionId,
  initContext,
  resolvePageUrl,
  truncate,
} from './context';
import { Reporter } from './reporter';
import {
  TrackingEventCodes,
  TRACKING_EVENT_PROPERTIES,
} from './events.generated';
import type {
  ApiCallInput,
  TrackableApp,
  TrackableRouter,
  TrackEventBody,
  TrackEventInput,
  TrackingHandle,
  TrackingOptions,
} from './types';

/** 默认选项；`url` 与 `appId` 必须由调用方提供（刻意不给默认值，避免误上报） */
export const DEFAULT_TRACKING_OPTIONS: TrackingOptions = {
  appId: '',
  batchSize: 10,
  enabled: true,
  flushIntervalMs: 5000,
  slowApiThresholdMs: 1000,
  url: '',
};

interface ActiveTracking {
  options: TrackingOptions;
  reporter: Reporter;
}

let active: ActiveTracking | null = null;

/** 慢接口阈值；由 `initTracking` 按选项设置（未启用埋点时不影响任何行为） */
let slowApiThresholdMs = DEFAULT_TRACKING_OPTIONS.slowApiThresholdMs;

/** 已被丢弃过的属性名；每个键只告警一次，避免同一错误刷屏 */
const warnedUnknownProperties = new Set<string>();

/**
 * 按事件目录的属性白名单裁剪 payload。
 *
 * 白名单来自生成的常量（事实源是 starter 的事件目录）：不在白名单内的键**不发**，
 * 并告警一次——与其等服务端逐条拒绝，不如在前端就把契约错误暴露出来。
 */
function prunePayload(
  eventCode: string,
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!payload) {
    return {};
  }
  const allowed = TRACKING_EVENT_PROPERTIES[eventCode];
  if (!allowed) {
    return {};
  }
  const pruned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const maxLength = allowed[key];
    if (maxLength === undefined) {
      if (!warnedUnknownProperties.has(key)) {
        warnedUnknownProperties.add(key);
        console.warn(
          `[tracking] 属性 ${key} 不在事件 ${eventCode} 的白名单内，已丢弃（同一属性只告警一次）`,
        );
      }
      continue;
    }
    pruned[key] =
      typeof value === 'string' && maxLength > 0
        ? truncate(value, maxLength)
        : value;
  }
  return pruned;
}

function buildBody(input: TrackEventInput, appId: string): TrackEventBody {
  return {
    anonId: currentAnonId(),
    appId,
    durationMs: input.durationMs,
    eventCode: input.eventCode,
    // 事件 ID 由客户端生成，是服务端的去重键
    eventId: `${currentSessionId()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    eventTime: new Date().toISOString(),
    // 路径解析只有一个入口：显式传入的地址按同一规则清洗，未传入时解析当前页面
    pageUrl: resolvePageUrl(input.pageUrl),
    payload: prunePayload(input.eventCode, input.payload),
    referrer: currentReferrer(),
    sessionId: currentSessionId(),
    success: input.success,
  };
}

function track(input: TrackEventInput): void {
  const current = active;
  if (!current) {
    return;
  }
  try {
    current.reporter.enqueue(buildBody(input, current.options.appId));
  } catch (error) {
    // 采集失败不得影响业务
    console.warn('[tracking] 事件入队失败', error);
  }
}

/**
 * 安装埋点 SDK。
 *
 * 未启用或未配置上报地址时**不安装任何采集器**，并打印一条告警——刻意不静默：
 * 「配了埋点却没有数据」比「明确报错」难排查得多。
 *
 * @param app     Vue 应用实例（用于接管 `errorHandler`）
 * @param router  路由实例（用于页面浏览与停留时长）
 * @param options 选项；`url` 为空即不启用
 * @returns 句柄：可手动 flush 或 stop
 */
export function initTracking(
  app: TrackableApp,
  router: TrackableRouter,
  options: Partial<TrackingOptions> = {},
): TrackingHandle {
  const merged: TrackingOptions = { ...DEFAULT_TRACKING_OPTIONS, ...options };
  if (!merged.enabled) {
    console.warn('[tracking] 已关闭，不采集任何数据');
    return { flush: () => Promise.resolve(), stop: () => {} };
  }
  if (!merged.url) {
    console.warn(
      '[tracking] 未配置上报地址（VITE_GLOB_TRACK_URL 或初始化选项 url），埋点未启动。',
    );
    return { flush: () => Promise.resolve(), stop: () => {} };
  }

  initContext();
  slowApiThresholdMs = merged.slowApiThresholdMs;
  const reporter = new Reporter(merged);
  active = { options: merged, reporter };

  const uninstallers = [
    installPageCollector(router, track),
    installClickCollector(track),
    installErrorCollector(app, track),
    installVitalsCollector(track),
  ];

  // 离页兜底：普通 fetch 在卸载阶段会被浏览器中止，改用 sendBeacon 把队列送出去。
  // 没有这一步，最后一批事件（含停留时长）几乎必然丢失。
  const flushOnHide = (): void => {
    reporter.flushOnHide();
  };
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      reporter.flushOnHide();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  globalThis.addEventListener('pagehide', flushOnHide);

  return {
    flush: () => reporter.flush(),
    stop: () => {
      for (const uninstall of uninstallers) {
        uninstall();
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      globalThis.removeEventListener('pagehide', flushOnHide);
      void reporter.flush();
      reporter.stop();
      active = null;
    },
  };
}

/**
 * 上报一次接口调用（由业务请求客户端的拦截器调用）。
 *
 * **只上报失败或慢调用**：每次接口调用都上报会让事件量翻十倍以上，而这类数据的分析价值
 * 集中在异常与变慢上；阈值由 `slowApiThresholdMs` 控制。
 *
 * 单独暴露函数而不是去 hook 请求客户端：SDK 不依赖 `@vben/request`，
 * 由应用决定在哪个客户端、哪个拦截器上采集。
 *
 * @param input 接口调用的耗时与结果
 */
export function reportApiCall(input: ApiCallInput): void {
  if (input.success && input.durationMs < slowApiThresholdMs) {
    return;
  }
  track({
    durationMs: input.durationMs,
    eventCode: TrackingEventCodes.API_REQUEST_END,
    pageUrl: currentPageUrl(),
    payload: {
      apiPath: truncate(input.path.split('?')[0] ?? input.path, 256),
      bizCode: input.bizCode ?? 0,
      httpMethod: truncate(input.httpMethod.toUpperCase(), 16),
    },
    success: input.success,
  });
}

export { TRACKING_EVENT_CATALOG, TrackingEventCodes } from './events.generated';
export type {
  TrackingEventCatalog,
  TrackingEventCatalogItem,
  TrackingEventCode,
  TrackingEventProperty,
} from './events.generated';
export type * from './types';
