import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSavedView,
  loadSavedViews,
  MAX_SAVED_VIEWS,
  persistSavedViews,
} from './use-saved-views';

const STORAGE_KEY = 'ypbin:tracking:event-views:v1';

/** 测试环境不保证提供 localStorage（vitest 默认 node 环境），用内存实现替代 */
function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  };
}

describe('saved filter views', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  it('没有保存过时返回空数组', () => {
    expect(loadSavedViews()).toEqual([]);
  });

  it('写入后可读回（字段名与筛选条件一致）', () => {
    const view = createSavedView('近1小时失败', {
      quickRange: '1h',
      success: 0,
    });

    persistSavedViews([view]);

    expect(loadSavedViews()).toEqual([
      {
        filters: { quickRange: '1h', success: 0 },
        id: view.id,
        name: '近1小时失败',
      },
    ]);
  });

  it('名称去首尾空格，ID 唯一', () => {
    const first = createSavedView('  接口失败  ', {});
    const second = createSavedView('接口失败', {});

    expect(first.name).toBe('接口失败');
    expect(first.id).not.toBe(second.id);
  });

  it('存储内容损坏时返回空数组而不是抛异常', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');

    expect(loadSavedViews()).toEqual([]);
  });

  it('忽略结构不合法的条目', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'a', name: 'ok', filters: {} }, { id: 1 }]),
    );

    expect(loadSavedViews()).toHaveLength(1);
    expect(loadSavedViews()[0]?.id).toBe('a');
  });

  it('视图数量上限是正数（保存时的校验依赖它）', () => {
    expect(MAX_SAVED_VIEWS).toBeGreaterThan(0);
  });
});
