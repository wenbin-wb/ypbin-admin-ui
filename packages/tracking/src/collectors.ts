/**
 * 采集器集合：页面、点击、异常、Web Vitals。
 *
 * 共同约定：
 * - 所有采集器只调用 `track()` 入队，不做任何网络请求；
 * - 所有监听器都自行 try/catch，采集失败不得影响业务页面；
 * - 采集器注册后返回“可卸载”函数，便于 `stop()` 彻底移除。
 */
import type {
  TrackableApp,
  TrackableErrorHandler,
  TrackableRoute,
  TrackableRouter,
  TrackEventInput,
} from './types';

import { sanitizeUrl, truncate } from './context';
import { TrackingEventCodes } from './events.generated';

/** 采集回调：把事件交给 SDK 入队 */
export type TrackFn = (input: TrackEventInput) => void;

/** 路由去重窗口：首屏权限守卫会触发一次重定向导航，不去重会让首屏 PV 翻倍 */
const ROUTE_DEDUPE_WINDOW_MS = 500;

/** 异常栈摘要上限 */
const MAX_STACK_LENGTH = 512;

/** 页面浏览与停留时长 */
export function installPageCollector(
  router: TrackableRouter,
  track: TrackFn,
): () => void {
  let current: null | { path: string; startedAt: number } = null;
  let lastReportedPath = '';
  let lastReportedAt = 0;

  const reportLeave = (): void => {
    if (!current) {
      return;
    }
    const { path, startedAt } = current;
    current = null;
    track({
      durationMs: Math.round(performance.now() - startedAt),
      eventCode: TrackingEventCodes.UI_PAGE_LEAVE,
      pageUrl: path,
      payload: { routeKey: path },
    });
  };

  const afterEach = (to: TrackableRoute): void => {
    // 被重定向/取消的导航不计入 PV（否则首屏会出现两条 page.view）
    const now = Date.now();
    if (
      to.path === lastReportedPath &&
      now - lastReportedAt < ROUTE_DEDUPE_WINDOW_MS
    ) {
      return;
    }
    lastReportedPath = to.path;
    lastReportedAt = now;
    reportLeave();
    current = { path: sanitizeUrl(to.path), startedAt: performance.now() };
    const title = (to.meta as { title?: unknown } | undefined)?.title;
    track({
      eventCode: TrackingEventCodes.UI_PAGE_VIEW,
      pageUrl: sanitizeUrl(to.path),
      payload: {
        routeKey: sanitizeUrl(to.path),
        routeTitle: truncate(typeof title === 'string' ? title : '', 128),
      },
    });
  };
  router.afterEach(afterEach);

  const onHide = (): void => {
    if (document.visibilityState === 'hidden') {
      reportLeave();
    }
  };
  document.addEventListener('visibilitychange', onHide);
  globalThis.addEventListener('pagehide', reportLeave);

  return () => {
    document.removeEventListener('visibilitychange', onHide);
    globalThis.removeEventListener('pagehide', reportLeave);
  };
}

/**
 * 白名单点击。
 *
 * 刻意不做“全量点击上报”：那会带来数量级更大的事件量，并把非预期的交互细节一并采走。
 * 只有显式声明 `data-track` 的元素才会被采集。
 */
export function installClickCollector(track: TrackFn): () => void {
  const onClick = (event: MouseEvent): void => {
    try {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const tracked = target.closest<HTMLElement>('[data-track]');
      const actionKey = tracked?.dataset.track;
      if (!tracked || !actionKey) {
        return;
      }
      track({
        eventCode: TrackingEventCodes.UI_CLICK_ACTION,
        pageUrl: sanitizeUrl(globalThis.location?.pathname ?? ''),
        payload: {
          actionKey: truncate(actionKey, 128),
          targetTag: truncate(tracked.tagName.toLowerCase(), 32),
        },
      });
    } catch {
      // 采集失败不得影响业务点击
    }
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}

/** 全局 JS 异常与资源加载失败 */
export function installErrorCollector(
  app: TrackableApp,
  track: TrackFn,
): () => void {
  // app.config 的类型收窄到本包用到的最小结构；赋值处的类型断言是刻意为之（见 types.ts 的说明）
  const appConfig = app.config as { errorHandler?: TrackableErrorHandler };
  const previousHandler = appConfig.errorHandler;
  appConfig.errorHandler = (error, instance, info) => {
    reportError(track, error, `vue:${String(info)}`);
    if (previousHandler) {
      previousHandler(error, instance, info);
    }
  };

  const onError = (event: ErrorEvent): void => {
    try {
      const target = event.target as EventTarget | null;
      // 资源加载失败：事件 target 是 script/link/img 等元素（capture 阶段才会收到）
      if (target && !(target instanceof Window)) {
        const element = target as Element;
        track({
          eventCode: TrackingEventCodes.WEB_ERROR_RESOURCE,
          payload: {
            resourceType: truncate(element.tagName.toLowerCase(), 32),
            resourceUrl: sanitizeUrl(
              element.getAttribute('src') ?? element.getAttribute('href') ?? '',
            ),
          },
        });
        return;
      }
      reportError(track, event.error ?? event.message, 'window:error');
    } catch {
      // 采集失败不得影响业务
    }
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    reportError(track, event.reason, 'unhandledrejection');
  };
  globalThis.addEventListener('error', onError, true);
  globalThis.addEventListener('unhandledrejection', onRejection);
  return () => {
    app.config.errorHandler = previousHandler;
    globalThis.removeEventListener('error', onError, true);
    globalThis.removeEventListener('unhandledrejection', onRejection);
  };
}

function reportError(track: TrackFn, error: unknown, errorType: string): void {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack ?? '') : '';
    track({
      eventCode: TrackingEventCodes.WEB_ERROR_JS,
      pageUrl: sanitizeUrl(globalThis.location?.pathname ?? ''),
      payload: {
        errorMessage: truncate(message, MAX_STACK_LENGTH),
        errorType: truncate(errorType, 64),
        stackDigest: truncate(
          stack.split('\n').slice(0, 3).join(' | '),
          MAX_STACK_LENGTH,
        ),
      },
    });
  } catch {
    // 采集失败不得影响业务
  }
}

/**
 * Web Vitals（LCP / CLS / TTFB）。
 *
 * 刻意**自研而不引第三方库**（与「自建全链路、零外部依赖」的选择一致），代价是：
 * 只采集这三个指标，**不采集 INP**——INP 的交互归因很容易做错，宁可少一个指标也不上报错的值。
 * 若日后需要 INP，引入 `web-vitals` 替换本函数即可（事件契约不变）。
 */
export function installVitalsCollector(track: TrackFn): () => void {
  let lcp = 0;
  let cls = 0;
  let clsLastEntryAt = 0;
  let clsWindowStart = 0;
  let clsWindowValue = 0;
  let reported = false;

  const observers: PerformanceObserver[] = [];
  const observe = (
    type: string,
    callback: (entries: PerformanceEntryList) => void,
  ): void => {
    try {
      const observer = new PerformanceObserver((list) =>
        callback(list.getEntries()),
      );
      observer.observe({ buffered: true, type } as PerformanceObserverInit);
      observers.push(observer);
    } catch {
      // 浏览器不支持该 entry 类型时静默跳过（属能力缺失，不是错误）
    }
  };

  observe('largest-contentful-paint', (entries) => {
    const last = entries.at(-1);
    if (last) {
      lcp = (last as PerformanceEntry & { startTime: number }).startTime;
    }
  });
  observe('layout-shift', (entries) => {
    for (const entry of entries) {
      const shift = entry as PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
      };
      if (shift.hadRecentInput) {
        continue;
      }
      // 会话窗口规则（与 Web Vitals 一致）：与上一条间隔超过 1s、或当前窗口已超过 5s 则另起窗口
      const now = entry.startTime;
      if (now - clsLastEntryAt > 1000 || now - clsWindowStart > 5000) {
        clsWindowValue = 0;
        clsWindowStart = now;
      }
      clsLastEntryAt = now;
      clsWindowValue += shift.value;
      cls = Math.max(cls, clsWindowValue);
    }
  });

  const reportVitals = (): void => {
    if (reported) {
      return;
    }
    reported = true;
    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    const ttfb = navigation
      ? navigation.responseStart - navigation.startTime
      : 0;
    const metrics: Array<[string, number]> = [
      ['LCP', Math.round(lcp)],
      ['CLS', Math.round(cls * 1000) / 1000],
      ['TTFB', Math.round(ttfb)],
    ];
    for (const [metric, value] of metrics) {
      if (value <= 0) {
        continue;
      }
      track({
        eventCode: TrackingEventCodes.WEB_VITAL_REPORT,
        pageUrl: sanitizeUrl(globalThis.location?.pathname ?? ''),
        payload: { metric, rating: ratingOf(metric, value), value },
      });
    }
  };

  const onHide = (): void => {
    if (document.visibilityState === 'hidden') {
      reportVitals();
    }
  };
  document.addEventListener('visibilitychange', onHide);
  globalThis.addEventListener('pagehide', reportVitals);

  return () => {
    for (const observer of observers) {
      observer.disconnect();
    }
    document.removeEventListener('visibilitychange', onHide);
    globalThis.removeEventListener('pagehide', reportVitals);
  };
}

/** 指标评级；阈值取自 Web Vitals 官方推荐值 */
function ratingOf(metric: string, value: number): string {
  if (metric === 'LCP') {
    return value <= 2500
      ? 'good'
      : (value <= 4000
        ? 'needs-improvement'
        : 'poor');
  }
  if (metric === 'CLS') {
    return value <= 0.1 ? 'good' : (value <= 0.25 ? 'needs-improvement' : 'poor');
  }
  return value <= 800 ? 'good' : (value <= 1800 ? 'needs-improvement' : 'poor');
}
