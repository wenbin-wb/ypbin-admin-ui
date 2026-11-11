import type { SystemTrackingApi } from '#/api/system/tracking';

/**
 * 事件域的展示元数据。
 *
 * 事件码是 `domain.object.action` 形式，域名（auth/api/ui/system/iot/ai）决定了这行事件
 * 属于哪类行为。列表里用「色点 + 域名标签」做视觉分组，比一片裸事件码更容易扫读。
 */
export interface EventDomainMeta {
  /** i18n 键（域名标签） */
  labelKey: string;
  /** 色点样式（tailwind 背景色） */
  dotClass: string;
}

const DOMAIN_META: Record<string, EventDomainMeta> = {
  ai: { dotClass: 'bg-violet-500', labelKey: 'tracking.events.domainAi' },
  api: { dotClass: 'bg-sky-500', labelKey: 'tracking.events.domainApi' },
  auth: { dotClass: 'bg-emerald-500', labelKey: 'tracking.events.domainAuth' },
  iot: { dotClass: 'bg-amber-500', labelKey: 'tracking.events.domainIot' },
  system: {
    dotClass: 'bg-indigo-500',
    labelKey: 'tracking.events.domainSystem',
  },
  ui: { dotClass: 'bg-slate-400', labelKey: 'tracking.events.domainUi' },
};

const FALLBACK_DOMAIN: EventDomainMeta = {
  dotClass: 'bg-muted-foreground/40',
  labelKey: 'tracking.events.domainOther',
};

/**
 * 取事件码所属域的展示元数据。
 *
 * @param eventCode 事件码（`domain.object.action`）
 * @return 域元数据；未知域名回退到「其他」
 */
export function eventDomain(eventCode?: string): EventDomainMeta {
  const domain = eventCode?.split('.')[0] ?? '';
  return DOMAIN_META[domain] ?? FALLBACK_DOMAIN;
}

/** 关键属性：键名 → 是否优先展示（越靠前越优先） */
const PAYLOAD_PRIORITY = [
  'path',
  'url',
  'route',
  'routePath',
  'method',
  'status',
  'statusCode',
  'errorCode',
  'error',
  'errorMessage',
  'message',
  'durationMs',
  'target',
  'title',
  'pageTitle',
];

/** 列表里最多展示几个属性 chip */
export const MAX_HIGHLIGHTS = 3;

/** 单个 chip 的文本长度上限（超出截断，完整值看详情） */
const MAX_CHIP_LENGTH = 48;

/**
 * 从 payload 里挑出列表要展示的「关键属性」。
 *
 * <p>挑选规则：先按事件排查时最关心的键（路径/方法/状态码/错误/耗时）排序，再按后端返回顺序补齐；
 * 只取原始类型，嵌套对象不展开——列表是扫读位，完整结构在详情里看。</p>
 *
 * @param payload 事件属性
 * @return 最多 {@link MAX_HIGHLIGHTS} 条 `{ label, value }`
 */
export function payloadHighlights(
  payload: Record<string, unknown> | undefined,
): Array<{ label: string; value: string }> {
  if (!payload) {
    return [];
  }
  const keys = Object.keys(payload).filter((key) => isPrimitive(payload[key]));
  const ranked = keys.toSorted((a, b) => rank(a) - rank(b));
  return ranked.slice(0, MAX_HIGHLIGHTS).map((key) => ({
    label: key,
    value: truncate(formatValue(payload[key])),
  }));
}

function rank(key: string): number {
  const index = PAYLOAD_PRIORITY.indexOf(key);
  return index === -1 ? PAYLOAD_PRIORITY.length : index;
}

function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  return String(value);
}

function truncate(text: string): string {
  if (text.length <= MAX_CHIP_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_CHIP_LENGTH - 1)}…`;
}

/**
 * 把 `yyyy-MM-dd HH:mm:ss` 截成 `HH:mm:ss`。
 *
 * @param time 服务端时间串
 * @return 时钟部分；无法识别时原样返回
 */
export function clockTime(time?: string): string {
  if (!time) {
    return '-';
  }
  const parts = time.split(' ');
  return parts.length > 1 ? (parts[1] ?? time) : time;
}

/**
 * 事件码的短名（去掉域名前缀）。
 *
 * @param eventCode 完整事件码
 * @return `domain.` 之后的部分；无前缀时原样返回
 */
export function shortEventCode(eventCode: string): string {
  const index = eventCode.indexOf('.');
  return index === -1 ? eventCode : eventCode.slice(index + 1);
}

/**
 * 事件行的失败判断（null/undefined 视为「无结果语义」，不算失败）。
 *
 * @param event 事件
 * @return 是否失败
 */
export function isFailed(event: SystemTrackingApi.TrackEvent): boolean {
  return event.success === 0;
}

/**
 * 慢事件阈值（毫秒）：列表里用橙色标出。
 */
export const SLOW_DURATION_MS = 1000;

/**
 * 耗时文本。
 *
 * @param durationMs 耗时（后端 Long 序列化为字符串）
 * @return 展示文本；缺失时为占位符
 */
export function durationText(durationMs?: string): string {
  return durationMs ? `${durationMs} ms` : '-';
}
