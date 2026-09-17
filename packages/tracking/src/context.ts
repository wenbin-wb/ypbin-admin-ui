/**
 * 事件上下文与隐私处理。
 *
 * 隐私红线（不做就会出合规问题，因此集中在单个文件里便于审查）：
 * 1. **绝不采集输入框内容**：SDK 不读取任何 `input` / `textarea` 的 `value`；
 * 2. **URL 一律去查询串**：查询串常含令牌、单号、手机号，只保留 path；
 * 3. **不采集任何存储中的值**：localStorage / cookie 的内容不上报；
 * 4. **字符串统一截断**：所有文本字段按上限截断，避免超长与日志注入。
 */

/** 文本字段统一截断上限（字符） */
const MAX_TEXT_LENGTH = 512;

/** 会话/匿名标识在 localStorage 中的键 */
const SESSION_KEY = 'ypbin-tracking-session';
const ANON_KEY = 'ypbin-tracking-anon';

/** 匿名标识与来源只在首次进入时确定，随后整个会话沿用 */
let sessionId = '';
let anonId = '';
let referrer = '';

/** 当前页面路径；由路由钩子写入，是 SDK 内唯一的“当前页面”事实源 */
let currentPagePath = '';

/** 生成一个短随机 ID（不引入额外依赖；碰撞概率对埋点维度足够低） */
function randomId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

/** 读取会话级标识；`sessionStorage` 缺失（如隐私模式）时退化为内存值，不抛异常 */
function readSessionStorage(key: string): string {
  try {
    return globalThis.sessionStorage?.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeSessionStorage(key: string, value: string): void {
  try {
    globalThis.sessionStorage?.setItem(key, value);
  } catch {
    // 隐私模式/配额满：退化为内存会话，属可接受降级，不打断业务
  }
}

/**
 * 初始化会话与来源信息；应在 SDK 启动时调用一次。
 *
 * <p>**不上报 UA 与渠道**：这两者都取服务端的权威值——UA 由后端从请求头读取、渠道由后端从
 * referrer 归因。客户端上报的值不可信，多传一份只会造成两套口径。</p>
 */
export function initContext(): void {
  sessionId = readSessionStorage(SESSION_KEY);
  if (!sessionId) {
    sessionId = randomId('s');
    writeSessionStorage(SESSION_KEY, sessionId);
  }
  anonId = readSessionStorage(ANON_KEY);
  if (!anonId) {
    anonId = randomId('a');
    writeSessionStorage(ANON_KEY, anonId);
  }
  referrer = sanitizeUrl(document.referrer, MAX_TEXT_LENGTH);
  // 尚未有导航写入路由路径：先按地址栏解析（hash 路由取 hash 段），
  // 保证首屏在路由钩子跑之前发生的事件也能拿到正确路径
  currentPagePath = '';
}

/** 当前会话 ID */
export function currentSessionId(): string {
  return sessionId;
}

/** 当前匿名标识 */
export function currentAnonId(): string {
  return anonId;
}

/** 来源（已去查询串）；无来源时为空串 */
export function currentReferrer(): string {
  return referrer;
}

/** 按上限截断文本 */
export function truncate(
  text: string,
  maxLength: number = MAX_TEXT_LENGTH,
): string {
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

/** 去掉查询串与哈希，只保留 path（相对地址不拼接 origin） */
export function sanitizeUrl(
  rawUrl: string,
  maxLength: number = MAX_TEXT_LENGTH,
): string {
  if (!rawUrl) {
    return '';
  }
  try {
    const url = new URL(
      rawUrl,
      globalThis.location?.origin ?? 'http://localhost',
    );
    return truncate(url.pathname, maxLength);
  } catch {
    // 非标准地址（如自定义协议）只做截断
    return truncate(rawUrl.split('?')[0] ?? rawUrl, maxLength);
  }
}

/**
 * 路由钩子写入当前页面路径（传入路由解析出的 `to.path`）。
 *
 * 采集器与 `reportApiCall` 统一从这里取路径，而不是各自去读 `location.pathname`：
 * 生产用 hash 路由时 `location.pathname` **恒为 `/`**，只有路由解析出的路径才正确。
 */
export function setCurrentPagePath(path: string): void {
  currentPagePath = sanitizeUrl(path);
}

/**
 * 解析页面路径（**全 SDK 唯一的路径解析点**）。
 *
 * - `rawUrl` 非空：去掉查询串与哈希后返回（路由钩子传入的 `to.path` 走这条）；
 * - `rawUrl` 为空：解析地址栏——**hash 路由**下真实路由在 `location.hash` 里
 *   （形如 `#/system/license`，此时 `pathname` 恒为 `/`），故优先取 hash 里的路由段；
 *   **history 路由**下 hash 为空，取 `location.pathname`，两种模式同时正确；
 * - 解析不出（无 location、hash 不是路由形态、非标准地址）时**退回 `pathname` 保持现状**，
 *   不抛错也不留空。
 */
export function resolvePageUrl(rawUrl?: string): string {
  if (rawUrl) {
    return sanitizeUrl(rawUrl);
  }
  const location = globalThis.location;
  const hash = location?.hash ?? '';
  // 只把 `#/...` 视为 hash 路由；`#section` 这类普通锚点不是路由，不能当成路径
  if (hash.startsWith('#/')) {
    const hashPath = sanitizeUrl(hash.slice(1));
    if (hashPath) {
      return hashPath;
    }
  }
  return sanitizeUrl(location?.pathname ?? '');
}

/**
 * 当前页面路径。
 *
 * 优先用路由钩子写入的值（导航后立即正确，且与 `ui.page.view` / `ui.page.leave` 同源）；
 * 路由钩子尚未跑过（如首屏异常早于首次导航）时回退到按 hash / history 解析地址栏。
 */
export function currentPageUrl(): string {
  return currentPagePath || resolvePageUrl();
}
