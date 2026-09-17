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

/** 会话级状态：匿名标识、会话 ID 只在首次进入时确定，随后整个会话沿用 */
let sessionId = '';
let anonId = '';
/**
 * 整页加载时的真实外部来源（`document.referrer` 的 pathname）。
 *
 * 浏览器只在**整页加载且来自其它站点**时才给 `document.referrer`，SPA 内部跳转永远拿不到；
 * 故它只用于**入口那一次页面浏览**的归因——若永久优先，站内来源将永远看不到它
 * （生产用 hash 路由，同源 referrer 经 `sanitizeUrl` 只剩 pathname `/`，见 `takePageViewReferrer`）。
 */
let externalReferrer = '';
/** 整页加载的外部来源是否已被入口页面浏览消费（只归因一次，不覆盖后续站内来源） */
let externalReferrerUsed = false;
/**
 * 最近一次被上报过页面浏览的路由（即下一个页面浏览的「上一页」；仅内存，不落存储）。
 *
 * 刻意**不复用** `currentPagePath`：路由钩子在 `ui.page.view` 上报**之前**就已写入新路径
 * （见 `installPageCollector`），若拿它当来源，每次页面浏览都会命中「来源 = 自己」的自引用守卫。
 * 本变量只在页面浏览被解析时推进，语义始终是「上一个页面浏览的路径」，与
 * `currentPageUrl()`（本页自身路径）是两件事。
 */
let lastPageViewUrl = '';
/**
 * 当前页面的来源：进入本页时解析一次后**冻结**。
 *
 * 本页的所有事件（页面浏览 / 离开 / 点击 / 接口 / 异常 / Web Vitals）都用它——若每次回读
 * 「最近一次页面浏览的路由」，非页面浏览事件拿到的会是**自己所在的页面**（自引用）。
 */
let pageReferrer = '';

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
  // 整页加载的真实外部来源：只用于入口那一次页面浏览的归因（见 takePageViewReferrer）
  externalReferrer = sanitizeUrl(document.referrer, MAX_TEXT_LENGTH);
  externalReferrerUsed = false;
  // 重新初始化即视为新的「当前会话内页面序列」，否则上一轮的最后页面会被当成本轮首屏的来源
  lastPageViewUrl = '';
  pageReferrer = '';
  // 尚未有导航写入路由路径：此时 currentPageUrl() 会退回 resolvePageUrl() 按地址栏解析
  // （hash 路由取 hash 段），保证首屏在路由钩子跑之前发生的事件也能拿到正确路径
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

/**
 * 当前页面的来源（已去查询串）：进入本页时解析并冻结，本页所有事件共用；
 * 无来源（首屏且直接访问）时为空串。
 */
export function currentPageReferrer(): string {
  return pageReferrer;
}

/**
 * 解析本次 `ui.page.view` 的来源，并把「本页来源」冻结为它、把本页记为当前页。
 *
 * **必须在构造事件体之前调用**（`index.ts` 的 `track` 已保证）。四条边界在此收口：
 * - 首屏没有上一页时返回空串，不伪造来源；
 * - 整页加载的外部来源（`document.referrer`）**只归因入口那一次**页面浏览：若永久优先，
 *   hash 路由下同源整页跳转（如 OAuth 回跳）的 referrer 经 `sanitizeUrl` 只剩 `/`，
 *   会把整个会话的站内来源全部盖掉；
 * - 与当前页相同（同页重复上报）时不把自身当来源，避免自引用；
 * - 结果一律过 `sanitizeUrl`（去查询串 + 按 `MAX_TEXT_LENGTH` 截断），不引入超出既有字段长度的内容。
 *
 * 传参的路径解析**不在本函数里做第二套**：`pageUrl` 必须是 `index.ts` 经
 * `resolvePageUrl()`（全 SDK 唯一解析入口，处理 hash / history 两种路由）解析后的结果。
 *
 * @param pageUrl 本次页面浏览的地址（由 `resolvePageUrl` 解析，未清洗亦可）
 */
export function takePageViewReferrer(pageUrl: string): string {
  const sanitized = sanitizeUrl(pageUrl, MAX_TEXT_LENGTH);
  let resolved = '';
  if (externalReferrer && !externalReferrerUsed) {
    resolved = externalReferrer;
    externalReferrerUsed = true;
  } else if (sanitized && sanitized !== lastPageViewUrl) {
    resolved = lastPageViewUrl;
  }
  // 统一自引用守卫：与当前页相同（含外部来源恰好就是当前页）时如实留空
  const referrer = resolved === sanitized ? '' : resolved;
  if (sanitized) {
    lastPageViewUrl = sanitized;
  }
  pageReferrer = referrer;
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
