/**
 * 生成物自洽性测试。
 *
 * `scripts/sync-tracking-events.mjs --check` 只保证「生成物与 starter 事实源一致」，
 * 本测试补一层「生成物内部三个导出彼此一致」：生成器若只改了一半逻辑（例如目录加了
 * 属性而属性映射漏了），漂移门禁仍然是绿的，只有这里能拦下。
 *
 * 刻意不硬编码事件个数——starter 新增事件后重跑生成器即可，测试无需跟着改。
 */
import { describe, expect, it } from 'vitest';

import {
  TRACKING_EVENT_CATALOG,
  TRACKING_EVENT_PROPERTIES,
  TrackingEventCodes,
} from './events.generated';

describe('埋点事件生成物', () => {
  it('事件码常量与事件目录一一对应', () => {
    const codes = Object.values(TrackingEventCodes).toSorted();
    expect(codes.length).toBeGreaterThan(0);
    expect(Object.keys(TRACKING_EVENT_CATALOG).toSorted()).toEqual(codes);
  });

  it('属性白名单与事件目录一一对应，且长度上限一致', () => {
    expect(Object.keys(TRACKING_EVENT_PROPERTIES).toSorted()).toEqual(
      Object.keys(TRACKING_EVENT_CATALOG).toSorted(),
    );
    for (const [code, meta] of Object.entries(TRACKING_EVENT_CATALOG)) {
      // 目录条目里的 code 必须与键一致，否则按动态事件码反查会串号
      expect(meta.code).toBe(code);
      const expected: Record<string, number> = {};
      for (const property of meta.properties) {
        expected[property.name] = property.maxLength ?? 0;
      }
      // 目录里的属性必须与 SDK 用于裁剪 payload 的白名单完全一致
      expect(TRACKING_EVENT_PROPERTIES[code]).toEqual(expected);
    }
  });

  it('事件目录条目具备展示所需字段', () => {
    for (const meta of Object.values(TRACKING_EVENT_CATALOG)) {
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.source.length).toBeGreaterThan(0);
      expect(meta.since.length).toBeGreaterThan(0);
      for (const property of meta.properties) {
        expect(property.name.length).toBeGreaterThan(0);
        expect(property.type.length).toBeGreaterThan(0);
      }
    }
  });
});
