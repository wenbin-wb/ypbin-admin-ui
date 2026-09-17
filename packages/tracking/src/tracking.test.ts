/**
 * 埋点 SDK 的运行时测试。
 *
 * 走**公开 API**（`initTracking` / `reportApiCall`），用假的 `fetch` 与假的路由实例验证
 * 真正发出去的东西——只验类型不足以证明事件形状正确。
 */
import type {
  TrackableApp,
  TrackableErrorHandler,
  TrackableRouter,
  TrackingHandle,
} from './types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initTracking, reportApiCall, TrackingEventCodes } from './index';

/** 捕获路由后置钩子，便于在测试里模拟导航 */
// 类型从接口派生，避免与 TrackableRouter 的签名各写一份而漂移
// （此前这里手写成单参数，与接口的三参数签名不兼容——该包此前没有 typecheck 门禁，所以一直没暴露）
type RouteHook = Parameters<TrackableRouter['afterEach']>[0];
let routeHook: null | RouteHook = null;

interface SentBody {
  appId: string;
  events: Array<{
    durationMs?: number;
    eventCode: string;
    eventId: string;
    pageUrl?: string;
    payload: Record<string, unknown>;
    referrer?: string;
    sessionId: string;
    success?: boolean;
  }>;
}

function createApp(): TrackableApp {
  return { config: {} };
}

function createRouter(): TrackableRouter {
  return {
    afterEach: (hook) => {
      routeHook = hook;
    },
  };
}

/** 取出最后一次 fetch 的请求体 */
function lastSentBody(fetchMock: ReturnType<typeof vi.fn>): SentBody {
  const calls = fetchMock.mock.calls;
  const last = calls.at(-1);
  return JSON.parse(
    String((last?.[1] as { body?: string } | undefined)?.body),
  ) as SentBody;
}

/** 取出最后一次 fetch 的请求头 */
function lastSentHeaders(
  fetchMock: ReturnType<typeof vi.fn>,
): Record<string, string> {
  const last = fetchMock.mock.calls.at(-1);
  return (
    (last?.[1] as { headers?: Record<string, string> } | undefined)?.headers ??
    {}
  );
}

/** 取出最后一次请求体里的页面浏览事件 */
function pageViews(fetchMock: ReturnType<typeof vi.fn>): SentBody['events'] {
  return lastSentBody(fetchMock).events.filter(
    (event) => event.eventCode === TrackingEventCodes.UI_PAGE_VIEW,
  );
}

/**
 * 覆盖 `document.referrer`（测试环境默认为空串），模拟「从站外整页加载进来」。
 *
 * 必须在 `initTracking` **之前**调用：SDK 只在初始化时读一次它。
 */
function stubDocumentReferrer(value: string): void {
  Object.defineProperty(document, 'referrer', {
    configurable: true,
    value,
  });
}

describe('tracking sdk', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  let handle: null | TrackingHandle = null;

  beforeEach(() => {
    routeHook = null;
    fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          accepted: 1,
          dropped: 0,
          reasons: {},
          received: 1,
          rejected: 0,
        },
      }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    handle?.stop();
    handle = null;
    // 立即解除对 document.referrer 的覆盖，避免污染后续用例
    Reflect.deleteProperty(document, 'referrer');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('未配置上报地址时不安装任何采集器，并给出告警', () => {
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      url: '',
    });

    expect(routeHook).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('未配置上报地址'),
    );
  });

  it('关闭时不安装采集器', () => {
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      enabled: false,
      url: '/tracking/ingest',
    });

    expect(routeHook).toBeNull();
  });

  it('上报页面浏览：事件码与属性都按契约填写', async () => {
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      url: '/tracking/ingest',
    });

    routeHook?.(
      {
        meta: { title: 'page.system.user' },
        path: '/system/user?token=secret',
      },
      undefined,
    );
    await handle.flush();

    const body = lastSentBody(fetchMock);
    expect(body.appId).toBe('ypbin-admin-ui');
    expect(body.events).toHaveLength(1);
    const [event] = body.events;
    expect(event?.eventCode).toBe(TrackingEventCodes.UI_PAGE_VIEW);
    // 查询串必须被剥掉（可能含令牌）
    expect(event?.pageUrl).toBe('/system/user');
    expect(event?.payload).toEqual({
      routeKey: '/system/user',
      routeTitle: 'page.system.user',
    });
    expect(event?.eventId).toBeTruthy();
    expect(event?.sessionId).toBeTruthy();
  });

  it('提供令牌时请求头带 Authorization: Bearer <token>', async () => {
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      getToken: () => 'token-from-access-store',
      url: '/tracking/ingest',
    });

    routeHook?.({ path: '/dashboard' }, undefined);
    await handle.flush();

    expect(lastSentHeaders(fetchMock)).toEqual({
      Authorization: 'Bearer token-from-access-store',
      'Content-Type': 'application/json',
    });
  });

  it('每次上报都重新取令牌（登录/登出后不沿用旧值）', async () => {
    let token: string | undefined;
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      getToken: () => token,
      url: '/tracking/ingest',
    });

    token = 'first-token';
    routeHook?.({ path: '/dashboard' }, undefined);
    await handle.flush();
    expect(lastSentHeaders(fetchMock).Authorization).toBe('Bearer first-token');

    token = 'second-token';
    routeHook?.({ path: '/system/user' }, undefined);
    await handle.flush();
    expect(lastSentHeaders(fetchMock).Authorization).toBe(
      'Bearer second-token',
    );
  });

  it('没有令牌（回调缺失或返回空）时不含 Authorization 头，保持匿名可用', async () => {
    // 场景一：宿主根本没提供 getToken 回调
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      url: '/tracking/ingest',
    });
    routeHook?.({ path: '/dashboard' }, undefined);
    await handle.flush();
    expect(lastSentHeaders(fetchMock)).not.toHaveProperty('Authorization');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 场景二：提供了回调但当前未登录（返回空值）
    handle.stop();
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      getToken: () => undefined,
      url: '/tracking/ingest',
    });
    routeHook?.({ path: '/system/user' }, undefined);
    await handle.flush();
    expect(lastSentHeaders(fetchMock)).not.toHaveProperty('Authorization');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('取令牌回调抛异常时降级为匿名上报，上报本身不失败', async () => {
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      getToken: () => {
        throw new Error('store not ready');
      },
      url: '/tracking/ingest',
    });

    routeHook?.({ path: '/dashboard' }, undefined);
    await expect(handle.flush()).resolves.toBeUndefined();

    expect(lastSentHeaders(fetchMock)).not.toHaveProperty('Authorization');
    expect(lastSentBody(fetchMock).events).toHaveLength(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('获取访问令牌失败'),
      expect.any(Error),
    );
  });

  it('首屏重定向导致的重复导航只产生一条 page.view', async () => {
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      url: '/tracking/ingest',
    });

    routeHook?.({ path: '/dashboard' }, undefined);
    routeHook?.({ path: '/dashboard' }, undefined);
    await handle.flush();

    const views = lastSentBody(fetchMock).events.filter(
      (event) => event.eventCode === TrackingEventCodes.UI_PAGE_VIEW,
    );
    expect(views).toHaveLength(1);
  });

  it('切换页面时上报上一条页面的停留时长', async () => {
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      url: '/tracking/ingest',
    });

    routeHook?.({ path: '/dashboard' }, undefined);
    routeHook?.({ path: '/system/user' }, undefined);
    await handle.flush();

    const leaves = lastSentBody(fetchMock).events.filter(
      (event) => event.eventCode === TrackingEventCodes.UI_PAGE_LEAVE,
    );
    expect(leaves).toHaveLength(1);
    expect(leaves[0]?.payload.routeKey).toBe('/dashboard');
    expect(typeof leaves[0]?.durationMs).toBe('number');
  });

  describe('referrer（来源取本页来源）', () => {
    it('首屏没有上一页时来源为空，不伪造来源', async () => {
      handle = initTracking(createApp(), createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });

      routeHook?.({ path: '/dashboard' }, undefined);
      await handle.flush();

      const [view] = pageViews(fetchMock);
      expect(view?.pageUrl).toBe('/dashboard');
      expect(view?.referrer).toBe('');
    });

    it('第二次页面浏览的来源是上一个路由', async () => {
      handle = initTracking(createApp(), createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });

      routeHook?.({ path: '/dashboard' }, undefined);
      routeHook?.({ path: '/system/user' }, undefined);
      await handle.flush();

      const views = pageViews(fetchMock);
      expect(views).toHaveLength(2);
      expect(views[0]?.referrer).toBe('');
      expect(views[1]?.referrer).toBe('/dashboard');
    });

    it('整页加载带来的外部来源用于入口页，且同样去掉查询串', async () => {
      stubDocumentReferrer('https://www.google.com/search?q=secret');
      handle = initTracking(createApp(), createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });

      routeHook?.({ path: '/dashboard' }, undefined);
      routeHook?.({ path: '/system/user' }, undefined);
      await handle.flush();

      const views = pageViews(fetchMock);
      expect(views[0]?.referrer).toBe('/search');
      // 外部来源只归因入口那一次：站内跳转仍取上一个路由，否则 hash 路由下
      // 同源整页跳转的 referrer 会被 sanitizeUrl 归一成 `/` 并永久压掉站内来源
      expect(views[1]?.referrer).toBe('/dashboard');
    });

    it('外部来源与当前页相同时不把自身当来源', async () => {
      stubDocumentReferrer('https://admin.example.com/dashboard');
      handle = initTracking(createApp(), createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });

      routeHook?.({ path: '/dashboard' }, undefined);
      await handle.flush();

      // 同址整页加载（新开标签页/整页跳同页）不得产生 pageUrl === referrer
      const [view] = pageViews(fetchMock);
      expect(view?.pageUrl).toBe('/dashboard');
      expect(view?.referrer).toBe('');
    });

    it('非页面浏览事件用「本页来源」，而不是本页自身', async () => {
      handle = initTracking(createApp(), createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });

      routeHook?.({ path: '/dashboard' }, undefined);
      routeHook?.({ path: '/system/user' }, undefined);
      reportApiCall({
        durationMs: 5000,
        httpMethod: 'get',
        path: '/system/user/list',
        success: false,
      });
      await handle.flush();

      const events = lastSentBody(fetchMock).events;
      const leave = events.find(
        (event) => event.eventCode === TrackingEventCodes.UI_PAGE_LEAVE,
      );
      const api = events.find(
        (event) => event.eventCode === TrackingEventCodes.API_REQUEST_END,
      );
      // 离开 /dashboard 的事件：来源是 /dashboard 的来源（首屏为空），不是它自己
      expect(leave?.pageUrl).toBe('/dashboard');
      expect(leave?.referrer).toBe('');
      // 在 /system/user 上发生的接口事件：来源是 /dashboard（本页来源），不是自身
      expect(api?.referrer).toBe('/dashboard');
    });

    it('同一页面重复上报时不把自己当上一页', async () => {
      // 采集器对 500ms 内的重复导航去重（见 installPageCollector），
      // 故用可控时钟越过该窗口，制造「同一路径连续两次上报」这一真实场景。
      let now = 1_700_000_000_000;
      vi.spyOn(Date, 'now').mockImplementation(() => now);

      handle = initTracking(createApp(), createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });

      routeHook?.({ path: '/dashboard' }, undefined);
      now += 1000;
      routeHook?.({ path: '/dashboard' }, undefined);
      await handle.flush();

      const views = pageViews(fetchMock);
      expect(views).toHaveLength(2);
      expect(views[0]?.referrer).toBe('');
      expect(views[1]?.referrer).toBe('');
    });

    it('来源按字段长度上限截断，不引入超长内容', async () => {
      const longPath = `/${'y'.repeat(600)}`;
      handle = initTracking(createApp(), createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });

      routeHook?.({ path: longPath }, undefined);
      routeHook?.({ path: '/system/user' }, undefined);
      await handle.flush();

      const views = pageViews(fetchMock);
      // MAX_TEXT_LENGTH = 512
      expect(views[0]?.referrer).toBe('');
      expect(views[1]?.referrer).toHaveLength(512);
    });
  });

  it('接口埋点只上报失败或慢调用', async () => {
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      slowApiThresholdMs: 1000,
      url: '/tracking/ingest',
    });

    reportApiCall({
      durationMs: 10,
      httpMethod: 'get',
      path: '/system/user/list',
      success: true,
    });
    await handle.flush();
    expect(fetchMock).not.toHaveBeenCalled();

    reportApiCall({
      durationMs: 10,
      httpMethod: 'get',
      path: '/system/user/list',
      success: false,
    });
    reportApiCall({
      durationMs: 2500,
      httpMethod: 'post',
      path: '/system/user/export',
      success: true,
    });
    await handle.flush();

    const events = lastSentBody(fetchMock).events.filter(
      (event) => event.eventCode === TrackingEventCodes.API_REQUEST_END,
    );
    expect(events).toHaveLength(2);
    expect(events[0]?.success).toBe(false);
    expect(events[1]?.durationMs).toBe(2500);
  });

  it('超长属性按事件目录的长度上限截断', async () => {
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      url: '/tracking/ingest',
    });

    reportApiCall({
      durationMs: 5,
      httpMethod: 'get',
      path: `/${'x'.repeat(400)}`,
      success: false,
    });
    await handle.flush();

    const [event] = lastSentBody(fetchMock).events;
    // api.request.end 的 apiPath 上限为 256
    expect(String(event?.payload.apiPath)).toHaveLength(256);
  });

  it('上报失败不重试、不抛异常，并给出告警', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      url: '/tracking/ingest',
    });

    routeHook?.({ path: '/dashboard' }, undefined);

    await expect(handle.flush()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('刻意不重试'),
      expect.any(Error),
    );
  });

  it('离页时用 sendBeacon 把队列送出去', async () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(globalThis.navigator, 'sendBeacon', {
      configurable: true,
      value: sendBeacon,
      writable: true,
    });
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      url: '/tracking/ingest',
    });

    routeHook?.({ path: '/dashboard' }, undefined);
    globalThis.dispatchEvent(new Event('pagehide'));

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as [string, Blob];
    expect(url).toBe('/tracking/ingest');
    expect(await blob.text()).toContain(TrackingEventCodes.UI_PAGE_VIEW);
  });

  it('stop 之后不再采集', async () => {
    handle = initTracking(createApp(), createRouter(), {
      appId: 'ypbin-admin-ui',
      url: '/tracking/ingest',
    });
    handle.stop();
    handle = null;

    reportApiCall({
      durationMs: 9999,
      httpMethod: 'get',
      path: '/x',
      success: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * 生产用 hash 路由（`createWebHashHistory`）：`location.pathname` 恒为 `/`，真实路由在
   * `location.hash` 里。此前各采集器各自读 `pathname`，真机上 `web.error.js` 等事件的
   * `pageUrl` 一律是 `/`。这组用例把「退化条件本身」也写成断言，改坏必转红。
   */
  describe('页面路径解析（pageUrl）', () => {
    /** 触发 Vue 全局错误处理——异常采集器的公开入口 */
    function reportVueError(app: TrackableApp): void {
      (app.config.errorHandler as TrackableErrorHandler)(
        new Error('boom'),
        undefined,
        'render',
      );
    }

    /** 追加一个白名单点击元素并派发点击 */
    function clickTracked(actionKey: string): void {
      const element = document.createElement('button');
      element.dataset.track = actionKey;
      document.body.append(element);
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      element.remove();
    }

    function eventOf(code: string) {
      return lastSentBody(fetchMock).events.find(
        (event) => event.eventCode === code,
      );
    }

    it('hash 路由：web.error.js 取 hash 里的路由段，而不是恒为 / 的 pathname', async () => {
      globalThis.history.replaceState(null, '', '/#/system/license');
      // 前置条件：先把「pathname 恒为 /」这个退化场景本身钉死
      expect(globalThis.location.pathname).toBe('/');
      expect(globalThis.location.hash).toBe('#/system/license');

      const app = createApp();
      handle = initTracking(app, createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });
      reportVueError(app);
      await handle.flush();

      expect(eventOf(TrackingEventCodes.WEB_ERROR_JS)?.pageUrl).toBe(
        '/system/license',
      );
    });

    it('hash 路由：hash 里的查询串同样被剥掉（不泄漏令牌）', async () => {
      globalThis.history.replaceState(
        null,
        '',
        '/#/system/license?token=secret',
      );

      const app = createApp();
      handle = initTracking(app, createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });
      reportVueError(app);
      await handle.flush();

      expect(eventOf(TrackingEventCodes.WEB_ERROR_JS)?.pageUrl).toBe(
        '/system/license',
      );
    });

    it('hash 路由：点击采集器与接口埋点同样取路由段', async () => {
      globalThis.history.replaceState(null, '', '/#/system/user');

      handle = initTracking(createApp(), createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });
      clickTracked('user.create');
      reportApiCall({
        durationMs: 2500,
        httpMethod: 'get',
        path: '/system/user/list',
        success: true,
      });
      await handle.flush();

      expect(eventOf(TrackingEventCodes.UI_CLICK_ACTION)?.pageUrl).toBe(
        '/system/user',
      );
      expect(eventOf(TrackingEventCodes.API_REQUEST_END)?.pageUrl).toBe(
        '/system/user',
      );
    });

    it('history 路由：hash 为空时取 pathname（本地开发路径不被破坏）', async () => {
      globalThis.history.replaceState(null, '', '/system/license');
      expect(globalThis.location.hash).toBe('');

      const app = createApp();
      handle = initTracking(app, createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });
      reportVueError(app);
      await handle.flush();

      expect(eventOf(TrackingEventCodes.WEB_ERROR_JS)?.pageUrl).toBe(
        '/system/license',
      );
    });

    it('hash 不是路由形态（普通锚点）时退回 pathname，保持既有行为', async () => {
      globalThis.history.replaceState(null, '', '/system/license#section');
      expect(globalThis.location.hash).toBe('#section');

      const app = createApp();
      handle = initTracking(app, createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });
      reportVueError(app);
      await handle.flush();

      expect(eventOf(TrackingEventCodes.WEB_ERROR_JS)?.pageUrl).toBe(
        '/system/license',
      );
    });

    it('导航后所有采集器复用路由解析出的路径（优先于地址栏）', async () => {
      globalThis.history.replaceState(null, '', '/#/dashboard');

      handle = initTracking(createApp(), createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });
      routeHook?.({ meta: {}, path: '/system/user?token=secret' }, undefined);
      clickTracked('user.create');
      await handle.flush();

      expect(eventOf(TrackingEventCodes.UI_CLICK_ACTION)?.pageUrl).toBe(
        '/system/user',
      );
    });

    /**
     * 合并用例：**路径解析统一**与**「本页来源」语义**必须同时成立。
     *
     * 两件事分别在各自的 describe 里被覆盖，但「在同一段真实时序里同时正确」是另一回事：
     * 页面路径走 `resolvePageUrl`（hash 路由取 hash 段），来源走 `takePageViewReferrer`
     * （外部来源只归因入口一次、同页不串、非页面浏览事件用冻结的本页来源）。任一被改弱，
     * 本用例都会转红。
     */
    it('hash 路由下路径与来源同时正确（外部来源只归因入口，站内来源取上一页）', async () => {
      globalThis.history.replaceState(
        null,
        '',
        '/#/system/license?token=secret',
      );
      expect(globalThis.location.pathname).toBe('/');
      stubDocumentReferrer('https://www.google.com/search?q=secret');

      const app = createApp();
      handle = initTracking(app, createRouter(), {
        appId: 'ypbin-admin-ui',
        url: '/tracking/ingest',
      });

      // 路由钩子尚未跑过：pageUrl 必须由 hash 段解析出来（#51 的语义）
      reportVueError(app);

      // 入口页浏览：来源是整页加载带来的外部来源（已去查询串）
      routeHook?.({ path: '/system/license' }, undefined);
      // 站内跳转：外部来源只归因入口一次，这里必须退化为上一个路由
      routeHook?.({ path: '/system/user' }, undefined);
      // 在 /system/user 上发生的非页面浏览事件：来源是「本页来源」，不是本页自身
      reportApiCall({
        durationMs: 5000,
        httpMethod: 'get',
        path: '/system/user/list',
        success: false,
      });
      await handle.flush();

      const views = pageViews(fetchMock);
      expect(views).toHaveLength(2);
      expect(views[0]?.pageUrl).toBe('/system/license');
      expect(views[0]?.referrer).toBe('/search');
      expect(views[1]?.pageUrl).toBe('/system/user');
      expect(views[1]?.referrer).toBe('/system/license');

      const error = eventOf(TrackingEventCodes.WEB_ERROR_JS);
      expect(error?.pageUrl).toBe('/system/license');
      const api = eventOf(TrackingEventCodes.API_REQUEST_END);
      expect(api?.pageUrl).toBe('/system/user');
      expect(api?.referrer).toBe('/system/license');
    });
  });
});
