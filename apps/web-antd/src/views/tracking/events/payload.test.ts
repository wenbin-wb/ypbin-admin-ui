import { beforeEach, describe, expect, it, vi } from 'vitest';

import { humanizePayload, translatePayloadValue } from './payload';

/**
 * 用可断言的假 i18n 替代真实语言包。
 *
 * `$te` 复刻 vue-i18n 的语义：只对登记过的 key 返回 true；
 * `$t` 复刻「命中不到就回显 key」的行为——`translatePayloadValue` 必须能扛住这一点。
 */
const locale = vi.hoisted(() => ({
  keys: new Set<string>(),
}));

vi.mock('@vben/locales', () => ({
  $t: (key: string, list?: unknown[]) => {
    if (list) {
      return `${String(list[0])}（${String(list[1])}）`;
    }
    return locale.keys.has(key) ? `translated:${key}` : key;
  },
  $te: (key: string) => locale.keys.has(key),
}));

describe('translatePayloadValue', () => {
  beforeEach(() => {
    locale.keys = new Set([
      'tracking.events.title',
      'page.dashboard.title',
      'system.online-user.title',
      // 驼峰 key 真实存在（如 system.onlineUser.title / ai.chat.newChat），必须能命中
      'system.onlineUser.title',
    ]);
  });

  it('命中 i18n key 时翻译，并保留原始 key 可查', () => {
    expect(translatePayloadValue('tracking.events.title')).toBe(
      'translated:tracking.events.title（tracking.events.title）',
    );
    expect(translatePayloadValue('system.onlineUser.title')).toBe(
      'translated:system.onlineUser.title（system.onlineUser.title）',
    );
  });

  it('未登记的 key 原样保留，不改写成空串', () => {
    expect(translatePayloadValue('tracking.events.notRegistered')).toBe(
      'tracking.events.notRegistered',
    );
  });

  it('普通文本不翻译（形态命中但语言包里没有）', () => {
    for (const text of [
      'System.out.println',
      'Foo.Bar.baz',
      'www.example.com',
      'config.json',
      'v1.2.3',
      'page_view',
      '这是一个正常的中文文本',
    ]) {
      expect(translatePayloadValue(text)).toBe(text);
    }
  });

  it('形态过滤先于 $te 生效：即使语言包里有同名条目也不翻译', () => {
    // 负向对照：把「不像 key」的字符串塞进假语言包，
    // 若形态过滤被误删，这几条断言就会失败（说明只剩 $te 一处防线）
    for (const text of [
      'title',
      'success',
      'hello world',
      '/dashboard/analysis',
      'user@example.com',
      'page..title',
      '.leading.dot',
      '',
    ]) {
      locale.keys.add(text);
      expect(translatePayloadValue(text)).toBe(text);
    }
  });

  it('非字符串一律不动（数字、布尔、null、undefined）', () => {
    for (const value of [1, 0, 0.5, true, false, null, undefined]) {
      expect(translatePayloadValue(value)).toBe(value);
    }
  });

  it('超长字符串不动（本仓不存在这么长的 i18n key）', () => {
    const tooLong = `a.${'b'.repeat(120)}`;
    locale.keys.add(tooLong);
    expect(translatePayloadValue(tooLong)).toBe(tooLong);
  });

  it('嵌套对象与数组整块不动（含其中看似 key 的字符串）', () => {
    const nested = { routeTitle: 'tracking.events.title' };
    const array = ['page.dashboard.title', 1];
    expect(translatePayloadValue(nested)).toBe(nested);
    expect(translatePayloadValue(array)).toBe(array);
  });

  it('空串不动（不是合法 key）', () => {
    expect(translatePayloadValue('')).toBe('');
  });

  it('翻译过必与原值不同（详情抽屉据此判断是否展示说明文案）', () => {
    expect(translatePayloadValue('tracking.events.title')).not.toBe(
      'tracking.events.title',
    );
    expect(translatePayloadValue('tracking.events.notRegistered')).toBe(
      'tracking.events.notRegistered',
    );
  });
});

describe('humanizePayload', () => {
  beforeEach(() => {
    locale.keys = new Set(['tracking.events.title', 'page.dashboard.title']);
  });

  it('翻译命中的顶层字符串，其余值原样保留', () => {
    expect(
      humanizePayload({
        routeTitle: 'tracking.events.title',
        eventCode: 'page_view',
        durationMs: 120,
        success: true,
        nested: { routeTitle: 'page.dashboard.title' },
        tags: ['tracking.events.title'],
        empty: '',
      }),
    ).toStrictEqual({
      routeTitle: 'translated:tracking.events.title（tracking.events.title）',
      eventCode: 'page_view',
      durationMs: 120,
      success: true,
      nested: { routeTitle: 'page.dashboard.title' },
      tags: ['tracking.events.title'],
      empty: '',
    });
  });

  it('不修改入参（纯函数）', () => {
    const payload = { routeTitle: 'tracking.events.title' };
    const result = humanizePayload(payload);
    expect(payload.routeTitle).toBe('tracking.events.title');
    expect(result).not.toBe(payload);
  });

  it('payload 缺失时返回空对象（便于 JSON.stringify 出 {}）', () => {
    expect(humanizePayload(undefined)).toStrictEqual({});
  });

  it('空 payload 原样返回空对象', () => {
    expect(humanizePayload({})).toStrictEqual({});
  });
});
