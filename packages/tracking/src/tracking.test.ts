/**
 * 埋点 SDK 的运行时测试。
 *
 * 走**公开 API**（`initTracking` / `reportApiCall`），用假的 `fetch` 与假的路由实例验证
 * 真正发出去的东西——只验类型不足以证明事件形状正确。
 */
import type { TrackableApp, TrackableRouter, TrackingHandle } from './types';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initTracking, reportApiCall, TrackingEventCodes } from './index';

/** 捕获路由后置钩子，便于在测试里模拟导航 */
let routeHook: ((to: { meta?: unknown; path: string }) => void) | null = null;

interface SentBody {
  appId: string;
  events: Array<{
    durationMs?: number;
    eventCode: string;
    eventId: string;
    pageUrl?: string;
    payload: Record<string, unknown>;
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

    routeHook?.({
      meta: { title: 'page.system.user' },
      path: '/system/user?token=secret',
    });
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

    routeHook?.({ path: '/dashboard' });
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
    routeHook?.({ path: '/dashboard' });
    await handle.flush();
    expect(lastSentHeaders(fetchMock).Authorization).toBe('Bearer first-token');

    token = 'second-token';
    routeHook?.({ path: '/system/user' });
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
    routeHook?.({ path: '/dashboard' });
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
    routeHook?.({ path: '/system/user' });
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

    routeHook?.({ path: '/dashboard' });
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

    routeHook?.({ path: '/dashboard' });
    routeHook?.({ path: '/dashboard' });
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

    routeHook?.({ path: '/dashboard' });
    routeHook?.({ path: '/system/user' });
    await handle.flush();

    const leaves = lastSentBody(fetchMock).events.filter(
      (event) => event.eventCode === TrackingEventCodes.UI_PAGE_LEAVE,
    );
    expect(leaves).toHaveLength(1);
    expect(leaves[0]?.payload.routeKey).toBe('/dashboard');
    expect(typeof leaves[0]?.durationMs).toBe('number');
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

    routeHook?.({ path: '/dashboard' });

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

    routeHook?.({ path: '/dashboard' });
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
});
