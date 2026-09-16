import { $t, $te } from '@vben/locales';

/**
 * i18n key 的形态。
 *
 * 后端部分上报方把「菜单/页面标题的 i18n key」当普通字符串塞进了 payload
 * （实测 `"routeTitle": "tracking.events.title"`），直接 JSON 展示等于给使用者看 key。
 *
 * 规则：点分**至少两段**，每段非空且只含字母/数字/下划线/连字符。
 * - 必须至少两段：语言包里也存在单段 key（`title`、`success` 等），但这类短串太容易与
 *   普通业务字符串撞车，故不收；
 * - 允许大写：本仓确实存在 `system.onlineUser.title`、`ai.chat.newChat` 这类驼峰 key，
 *   只认小写会漏。按运行期装配（`packages/locales/src/i18n.ts` 与
 *   `apps/web-antd/src/locales/index.ts` 都用 `loadLocalesMapFromDir`，即两侧语言包都按
 *   文件名嵌套）实测 zh-CN 共 1523 个 key，本正则一个都不漏，其中 977 个含大写段。
 *
 * 这条规则只做「形态像不像 key」的粗筛，**真正的判据是 `$te`**（见下）——
 * 所以 `www.example.com`、`System.out.println` 这类普通文本即使形态命中，也不会被翻译。
 */
const I18N_KEY_PATTERN = /^[A-Za-z0-9][\w-]*(?:\.[\w-]+)+$/;

/**
 * key 长度上限。
 *
 * 实测本仓最长的 key 是 55 字符，这里取 100 作为上限（约 1.8 倍余量）；超过这个长度的
 * 字符串不可能是 i18n key，直接跳过，避免对长文本做无谓的翻译查找。
 */
const MAX_I18N_KEY_LENGTH = 100;

/**
 * 翻译单个 payload 值。
 *
 * 只有同时满足「是字符串」「形如 i18n key」「该 key 在当前语言包里确实存在」的值才会被翻译；
 * 其余（普通文本、未登记的 key、数字/布尔/null/对象/数组）一律原样返回。
 *
 * 翻译结果形如 `中文（原 key）`：既让使用者看到中文，又保留原始值可查（原始 key 就是上报值）。
 */
export function translatePayloadValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  if (value.length > MAX_I18N_KEY_LENGTH || !I18N_KEY_PATTERN.test(value)) {
    return value;
  }
  if (!$te(value)) {
    return value;
  }
  const translated: unknown = $t(value);
  // 命中不到时 `$t` 会回显 key 本身；命中到的是命名空间节点（对象）时也不是可展示的字符串。
  // 这两种情况按「未命中」处理，保持原值，避免把 payload 展示成看不懂的样子。
  if (
    typeof translated !== 'string' ||
    translated === '' ||
    translated === value
  ) {
    return value;
  }
  return $t('tracking.events.payloadTranslated', [translated, value]);
}

/**
 * 生成展示用的 payload。
 *
 * 只处理**顶层字符串值**：后端契约里 payload 的值是白名单内的原始类型
 * （见 `#/api/system/tracking` 的 `TrackEvent.payload`），因此不做递归——
 * 对象/数组原样保留，不会连带改动其中嵌套的字符串。
 *
 * 纯函数：不修改入参，返回新对象。
 */
export function humanizePayload(
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!payload) {
    return {};
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    result[key] = translatePayloadValue(value);
  }
  return result;
}
