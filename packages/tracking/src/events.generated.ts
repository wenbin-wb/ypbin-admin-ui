/**
 * 埋点事件码与属性白名单（生成物，请勿手工修改）。
 *
 * 事实源：ypbin-starter 仓库的 `docs/tracking-events.json`；
 * 生成器：本仓库 `scripts/sync-tracking-events.mjs`。
 * 修改事件目录请到 starter 仓库改事实源，然后重跑本脚本，否则 CI 的漂移门禁会失败。
 */

/** 事件码常量：页面里禁止手写事件码字符串 */
export const TrackingEventCodes = {
  API_REQUEST_END: 'api.request.end',
  AUTH_USER_LOGIN: 'auth.user.login',
  AUTH_USER_LOGOUT: 'auth.user.logout',
  IOT_COLLECTOR_ERROR: 'iot.collector.error',
  IOT_COLLECTOR_READ: 'iot.collector.read',
  SYSTEM_USER_EXPORT: 'system.user.export',
  UI_CLICK_ACTION: 'ui.click.action',
  UI_PAGE_LEAVE: 'ui.page.leave',
  UI_PAGE_VIEW: 'ui.page.view',
  WEB_ERROR_JS: 'web.error.js',
  WEB_ERROR_RESOURCE: 'web.error.resource',
  WEB_VITAL_REPORT: 'web.vital.report',
} as const;

/** 已登记的事件码联合类型 */
export type TrackingEventCode =
  (typeof TrackingEventCodes)[keyof typeof TrackingEventCodes];

/**
 * 事件码到属性白名单的映射：属性名 -> 最大字符长度（非字符串或未声明为 0，表示不限制）。
 *
 * SDK 据此在发送前裁剪 payload——不在白名单内的键一律不发，避免服务端逐条拒绝。
 */
export const TRACKING_EVENT_PROPERTIES: Record<
  string,
  Record<string, number>
> = {
  'api.request.end': { apiPath: 256, bizCode: 0, httpMethod: 16 },
  'auth.user.login': { authType: 32 },
  'auth.user.logout': {},
  'iot.collector.error': { errorType: 64, protocolCode: 32 },
  'iot.collector.read': { pointCount: 0, protocolCode: 32, successCount: 0 },
  'system.user.export': { rowCount: 0 },
  'ui.click.action': { actionKey: 128, targetTag: 32 },
  'ui.page.leave': { routeKey: 128, stayMs: 0 },
  'ui.page.view': { routeKey: 128, routeTitle: 128 },
  'web.error.js': { errorMessage: 512, errorType: 64, stackDigest: 512 },
  'web.error.resource': { resourceType: 32, resourceUrl: 512 },
  'web.vital.report': { metric: 16, rating: 16, value: 0 },
};
