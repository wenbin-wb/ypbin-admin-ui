import { describe, expect, it } from 'vitest';

import {
  clockTime,
  durationText,
  eventDomain,
  MAX_HIGHLIGHTS,
  payloadHighlights,
  shortEventCode,
} from './meta';

describe('payloadHighlights', () => {
  it('按排查优先级挑选键，而不是按对象顺序', () => {
    const highlights = payloadHighlights({
      routeTitle: 'tracking.events.title',
      status: 500,
      path: '/user/list',
      method: 'GET',
    });

    expect(highlights.map((item) => item.label)).toEqual([
      'path',
      'method',
      'status',
    ]);
  });

  it('最多返回 MAX_HIGHLIGHTS 条，且跳过嵌套对象', () => {
    const highlights = payloadHighlights({
      path: '/a',
      method: 'POST',
      status: 200,
      nested: { deep: true },
      extra: 'x',
    });

    expect(highlights).toHaveLength(MAX_HIGHLIGHTS);
    expect(highlights.map((item) => item.label)).not.toContain('nested');
  });

  it('长文本截断，完整值不进入列表', () => {
    const longPath = `/very/${'x'.repeat(80)}`;
    const [first] = payloadHighlights({ path: longPath });

    expect(first?.value.endsWith('…')).toBe(true);
    expect(first?.value.length).toBeLessThan(longPath.length);
  });

  it('空 payload 返回空数组（不臆造占位行）', () => {
    expect(payloadHighlights(undefined)).toEqual([]);
    expect(payloadHighlights({})).toEqual([]);
  });
});

describe('clockTime', () => {
  it('取时钟部分', () => {
    expect(clockTime('2026-11-11 14:32:05')).toBe('14:32:05');
  });

  it('缺失时返回占位符', () => {
    expect(clockTime(undefined)).toBe('-');
  });
});

describe('eventDomain', () => {
  it('按事件码首段归类', () => {
    expect(eventDomain('auth.user.login').labelKey).toBe(
      'tracking.events.domainAuth',
    );
    expect(eventDomain('api.request.end').labelKey).toBe(
      'tracking.events.domainApi',
    );
  });

  it('未知域回退到「其他」', () => {
    expect(eventDomain('custom.thing.done').labelKey).toBe(
      'tracking.events.domainOther',
    );
    expect(eventDomain(undefined).labelKey).toBe('tracking.events.domainOther');
  });
});

describe('shortEventCode', () => {
  it('去掉域名前缀', () => {
    expect(shortEventCode('auth.user.login')).toBe('user.login');
    expect(shortEventCode('login')).toBe('login');
  });
});

describe('durationText', () => {
  it('毫秒文本与占位符', () => {
    expect(durationText('120')).toBe('120 ms');
    expect(durationText(undefined)).toBe('-');
  });
});
