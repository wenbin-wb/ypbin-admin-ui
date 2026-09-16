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

/**
 * 事件目录里的单个属性（白名单条目）。
 *
 * 与 {@link TRACKING_EVENT_PROPERTIES} 的区别：后者只服务于 SDK 的发送前裁剪，
 * 本类型保留类型/必填/描述等展示信息，供管理端只读展示与排障使用。
 */
export interface TrackingEventProperty {
  /** 属性名（上报 payload 的键，与后端同名） */
  name: string;
  /** 属性类型（事实源声明的类型名，如 string / integer / number） */
  type: string;
  /** 字符串最大长度；事实源未声明即省略，表示不在前端截断 */
  maxLength?: number;
  /** 是否必填；事实源未声明即省略——省略代表"目录未声明"，不等于"非必填" */
  required?: boolean;
  /** 属性说明 */
  description: string;
}

/** 事件目录条目 */
export interface TrackingEventCatalogItem {
  /** 事件码 */
  code: string;
  /** 事件说明（取自事实源，中文） */
  description: string;
  /** 事件来源：web / backend / iot */
  source: string;
  /** 引入版本 */
  since: string;
  /** 属性白名单（按属性名升序） */
  properties: TrackingEventProperty[];
}

/**
 * 事件目录：事件码 -> 元数据（描述、来源、引入版本与属性白名单明细）。
 *
 * 面向"事件目录"这类只读展示，以及用**动态事件码**（如列表行）反查人话描述的场合。
 * 键按事件码升序排列，遍历 {@link Object.values} 即得到有序列表。
 */
export type TrackingEventCatalog = Record<string, TrackingEventCatalogItem>;

export const TRACKING_EVENT_CATALOG: TrackingEventCatalog = {
  'api.request.end': {
    code: 'api.request.end',
    description: '接口调用结束：含耗时与业务结果',
    source: 'web',
    since: '3.2.0',
    properties: [
      {
        name: 'apiPath',
        type: 'string',
        maxLength: 256,
        description: '接口路径（不含查询参数）',
      },
      {
        name: 'bizCode',
        type: 'integer',
        description: '业务响应码',
      },
      {
        name: 'httpMethod',
        type: 'string',
        maxLength: 16,
        description: 'HTTP 方法',
      },
    ],
  },
  'auth.user.login': {
    code: 'auth.user.login',
    description: '登录成功',
    source: 'backend',
    since: '3.2.0',
    properties: [
      {
        name: 'authType',
        type: 'string',
        maxLength: 32,
        description: '认证方式（账号 / 短信 / 社交）',
      },
    ],
  },
  'auth.user.logout': {
    code: 'auth.user.logout',
    description: '用户登出',
    source: 'backend',
    since: '3.2.0',
    properties: [],
  },
  'iot.collector.error': {
    code: 'iot.collector.error',
    description: 'IoT 采集异常（异常分类必须取有限枚举值，避免标签基数爆炸）',
    source: 'iot',
    since: '3.2.0',
    properties: [
      {
        name: 'errorType',
        type: 'string',
        maxLength: 64,
        description: '异常分类（有限枚举值）',
      },
      {
        name: 'protocolCode',
        type: 'string',
        maxLength: 32,
        description: '协议 code',
      },
    ],
  },
  'iot.collector.read': {
    code: 'iot.collector.read',
    description: 'IoT 采集读取结果（由平台侧适配器装饰器上报）',
    source: 'iot',
    since: '3.2.0',
    properties: [
      {
        name: 'pointCount',
        type: 'integer',
        description: '读取点位数',
      },
      {
        name: 'protocolCode',
        type: 'string',
        maxLength: 32,
        description: '协议 code',
      },
      {
        name: 'successCount',
        type: 'integer',
        description: '成功点位数',
      },
    ],
  },
  'system.user.export': {
    code: 'system.user.export',
    description: '用户数据导出（业务事件示例）',
    source: 'backend',
    since: '3.2.0',
    properties: [
      {
        name: 'rowCount',
        type: 'integer',
        description: '导出行数',
      },
    ],
  },
  'ui.click.action': {
    code: 'ui.click.action',
    description: '白名单点击：元素需显式声明 data-track 属性才会采集',
    source: 'web',
    since: '3.2.0',
    properties: [
      {
        name: 'actionKey',
        type: 'string',
        maxLength: 128,
        description: 'data-track 声明的动作标识',
      },
      {
        name: 'targetTag',
        type: 'string',
        maxLength: 32,
        description: '触发元素的标签名',
      },
    ],
  },
  'ui.page.leave': {
    code: 'ui.page.leave',
    description: '页面离开：携带本次停留时长',
    source: 'web',
    since: '3.2.0',
    properties: [
      {
        name: 'routeKey',
        type: 'string',
        maxLength: 128,
        description: '路由标识（不含查询参数）',
      },
      {
        name: 'stayMs',
        type: 'integer',
        description: '停留毫秒数',
      },
    ],
  },
  'ui.page.view': {
    code: 'ui.page.view',
    description: '页面浏览：路由进入后上报一次',
    source: 'web',
    since: '3.2.0',
    properties: [
      {
        name: 'routeKey',
        type: 'string',
        maxLength: 128,
        description: '路由标识（不含查询参数）',
      },
      {
        name: 'routeTitle',
        type: 'string',
        maxLength: 128,
        description: '页面标题',
      },
    ],
  },
  'web.error.js': {
    code: 'web.error.js',
    description: '前端 JS 运行时异常',
    source: 'web',
    since: '3.2.0',
    properties: [
      {
        name: 'errorMessage',
        type: 'string',
        maxLength: 512,
        description: '异常信息（已截断）',
      },
      {
        name: 'errorType',
        type: 'string',
        maxLength: 64,
        description: '异常类型',
      },
      {
        name: 'stackDigest',
        type: 'string',
        maxLength: 512,
        description: '调用栈摘要（已截断）',
      },
    ],
  },
  'web.error.resource': {
    code: 'web.error.resource',
    description: '前端资源加载失败',
    source: 'web',
    since: '3.2.0',
    properties: [
      {
        name: 'resourceType',
        type: 'string',
        maxLength: 32,
        description: '资源类型（script / link / img 等）',
      },
      {
        name: 'resourceUrl',
        type: 'string',
        maxLength: 512,
        description: '资源地址（已脱敏）',
      },
    ],
  },
  'web.vital.report': {
    code: 'web.vital.report',
    description: 'Web Vitals 指标上报（LCP / INP / CLS / TTFB）',
    source: 'web',
    since: '3.2.0',
    properties: [
      {
        name: 'metric',
        type: 'string',
        maxLength: 16,
        description: '指标名',
      },
      {
        name: 'rating',
        type: 'string',
        maxLength: 16,
        description: '评级（good / needs-improvement / poor）',
      },
      {
        name: 'value',
        type: 'number',
        description: '指标值',
      },
    ],
  },
};
