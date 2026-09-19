/**
 * 埋点标识随机源的测试。
 *
 * 背景：会话 ID / 事件 ID 此前用 `Math.random()` 生成——它既容易碰撞也容易被预测
 * （CodeQL `js/insecure-randomness` 对安全上下文里的 `Math.random()` 报警）。
 * 现改为优先走 Web Crypto，并对「非安全上下文」提供只保证唯一性的兜底。
 *
 * 这里锁住两件事：**字符集与长度**（下游按字面量拼接/去重，格式不能漂）、
 * **短时间大量取值不重复**（唯一性）。
 */
import { describe, expect, it } from 'vitest';

import { randomSuffix } from './context';

describe('randomSuffix', () => {
  it('返回指定长度的 [0-9a-z] 串', () => {
    for (const length of [4, 6, 8, 12]) {
      const value = randomSuffix(length);
      expect(value).toHaveLength(length);
      expect(value).toMatch(/^[0-9a-z]+$/);
    }
  });

  it('连续取值不重复（唯一性；这里的量级足以暴露「每次都一样」的实现）', () => {
    const values = new Set(Array.from({ length: 200 }, () => randomSuffix(8)));
    expect(values.size).toBe(200);
  });
});
