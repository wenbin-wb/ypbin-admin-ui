import type { SystemBlocklistApi } from '#/api/system/blocklist';

/** 与后端/接口保持同一份联合类型，避免前端两处定义漂移 */
export type MatchType = SystemBlocklistApi.MatchType;

function isIPv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isIPv6(value: string): boolean {
  if (!value.includes(':')) {
    return false;
  }
  const parts = value.split('::');
  if (parts.length > 2) {
    return false;
  }
  const hasDoubleColon = parts.length === 2;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = hasDoubleColon && parts[1] ? parts[1].split(':') : [];

  const groups = [...head, ...tail];
  if (groups.length === 0) {
    return hasDoubleColon;
  }

  // 末尾允许嵌入 IPv4（如 ::ffff:1.2.3.4），按两个 IPv6 组计算
  const last = groups.at(-1);
  if (last?.includes('.')) {
    if (!isIPv4(last)) {
      return false;
    }
    groups.splice(-1, 1, '0', '0');
  }

  if (!groups.every((group) => /^[\da-f]{1,4}$/i.test(group))) {
    return false;
  }
  return hasDoubleColon ? groups.length <= 7 : groups.length === 8;
}

/** 校验 IP 字面量：IPv4、IPv6，或 starter 支持的 `[IPv6]:port` 形式。 */
export function isValidIp(value: string): boolean {
  let candidate = value.trim();
  if (candidate.startsWith('[')) {
    const end = candidate.indexOf(']');
    if (end === -1) {
      return false;
    }
    const rest = candidate.slice(end + 1);
    if (rest && !/^:\d{1,5}$/.test(rest)) {
      return false;
    }
    candidate = candidate.slice(1, end);
  }
  return isIPv4(candidate) || isIPv6(candidate);
}

/** 校验 CIDR：IP 部分合法，且前缀在对应地址族的范围内。 */
export function isValidCidr(value: string): boolean {
  const trimmed = value.trim();
  const slash = trimmed.lastIndexOf('/');
  if (slash <= 0) {
    return false;
  }
  const ip = trimmed.slice(0, slash).trim();
  const prefixText = trimmed.slice(slash + 1).trim();
  if (!/^\d{1,3}$/.test(prefixText) || !isValidIp(ip)) {
    return false;
  }
  const prefix = Number(prefixText);
  const max = isIPv4(ip) ? 32 : 128;
  return prefix >= 0 && prefix <= max;
}

/** 按 matchType 校验匹配值；与后端 normalize 规则保持一致。 */
export function isValidMatchValue(type: MatchType, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  switch (type) {
    case 'CIDR': {
      return isValidCidr(trimmed);
    }
    case 'IP': {
      return isValidIp(trimmed);
    }
    case 'PATH': {
      return trimmed.startsWith('/');
    }
    case 'USER_AGENT': {
      return trimmed.length >= 3 && trimmed.length <= 255;
    }
    default: {
      return false;
    }
  }
}
