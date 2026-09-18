import { describe, expect, it } from 'vitest';

import { resolveWatermarkContent } from './use-watermark';

/**
 * 一律断言输出里没有 `undefined` / `null` 字面量。
 *
 * 修复前的拼接式 `` `${username} - ${realName}` `` 在 `realName` 为 `null` 时
 * 会把这个字面量直接画到水印上（生产环境观察到的就是 `xxx - null`）。
 */
function expectNoPlaceholderLiteral(text: string) {
  expect(text).not.toContain('undefined');
  expect(text).not.toContain('null');
}

describe('resolveWatermarkContent', () => {
  it('realName 为 null 时只显示用户名，不留 `null` 字面量与悬空分隔符', () => {
    const content = resolveWatermarkContent({
      content: '',
      realName: null,
      username: 'admin',
    });
    expect(content).toBe('admin');
    expectNoPlaceholderLiteral(content);
  });

  it('realName 为 undefined（userInfo 未加载）时同样只显示用户名', () => {
    const content = resolveWatermarkContent({
      content: '',
      realName: undefined,
      username: 'admin',
    });
    expect(content).toBe('admin');
    expectNoPlaceholderLiteral(content);
  });

  it('realName 为空串或纯空白时视为无内容', () => {
    expect(
      resolveWatermarkContent({ content: '', realName: '', username: 'admin' }),
    ).toBe('admin');
    expect(
      resolveWatermarkContent({
        content: '',
        realName: '   ',
        username: 'admin',
      }),
    ).toBe('admin');
  });

  it('正常值行为不变：用户名 - 显示名（保持既有分隔符与英文空格）', () => {
    expect(
      resolveWatermarkContent({
        content: '',
        realName: '张三',
        username: 'admin',
      }),
    ).toBe('admin - 张三');
  });

  it('username 缺失（userInfo 未加载）时只显示 realName', () => {
    expect(
      resolveWatermarkContent({
        content: '',
        realName: '张三',
        username: null,
      }),
    ).toBe('张三');
    expect(
      resolveWatermarkContent({
        content: '',
        realName: '张三',
        username: undefined,
      }),
    ).toBe('张三');
  });

  it('两个字段都不可用时返回空串（水印模块的默认 content），而不是占位垃圾', () => {
    for (const realName of [null, undefined, '', '  ']) {
      for (const username of [null, undefined, '', '  ']) {
        const content = resolveWatermarkContent({
          content: '',
          realName,
          username,
        });
        expect(content).toBe('');
        expectNoPlaceholderLiteral(content);
      }
    }
  });

  it('自定义文案优先，且不受 realName 可空影响', () => {
    expect(
      resolveWatermarkContent({
        content: '内部资料',
        realName: null,
        username: 'admin',
      }),
    ).toBe('内部资料');
  });

  it('自定义文案为 null/undefined/纯空白时回退到拼接', () => {
    for (const content of [null, undefined, '', '  ']) {
      expect(
        resolveWatermarkContent({
          content,
          realName: '张三',
          username: 'admin',
        }),
      ).toBe('admin - 张三');
    }
  });

  it('不改变非空片段本身（不做 trim，正常值显示与修复前一致）', () => {
    expect(
      resolveWatermarkContent({
        content: '',
        realName: ' 张三 ',
        username: ' admin ',
      }),
    ).toBe(' admin  -  张三 ');
  });
});
