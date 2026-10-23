import type { SystemSpaceApi } from '#/api/system/space';

import { describe, expect, it } from 'vitest';

import { collectSubtreeIds, toSpaceTree } from './space-tree';

/**
 * 断言值非空并收窄类型（替代 `!` 非空断言）。
 *
 * <p>本仓 oxlint 禁止 `!`（no-non-null-assertion）：它只影响类型、运行时不检查，
 * 一旦结构变化会得到 undefined 上的迷之报错。这里显式断言，失败信息也更清楚。</p>
 *
 * @param value 待断言值
 * @param label 用于失败提示的字段名
 * @returns 收窄后的值
 */
function at<T>(value: null | T | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`期望 ${label} 存在，实际为 ${String(value)}`);
  }
  return value;
}

function space(
  id: string,
  name: string,
  children?: SystemSpaceApi.SpaceResp[],
  code?: string,
): SystemSpaceApi.SpaceResp {
  return {
    code,
    children,
    id,
    name,
    pid: '0',
    spaceType: 'office',
    status: 1,
  } as any;
}

/** 典型空间树：园区 → A栋 → 1F → 101室 */
function sampleTree(): SystemSpaceApi.SpaceResp[] {
  return [
    space('1', '总部园区', [
      space('2', 'A栋', [
        space('3', '1F', [space('4', '101室', undefined, 'A-101')]),
      ]),
      space('5', 'B栋'),
    ]),
  ];
}

describe('toSpaceTree', () => {
  it('保留层级结构，叶子节点的 children 为 undefined（不是空数组）', () => {
    const tree = toSpaceTree(sampleTree());
    expect(tree).toHaveLength(1);
    expect(at(tree[0], 'tree[0]').label).toBe('总部园区');
    expect(at(tree[0], 'tree[0]').children).toHaveLength(2);
    expect(
      at(at(at(tree[0], 'tree[0]').children, 'children')[0], 'children[0]')
        .label,
    ).toBe('A栋');
    // B栋 无子节点 ⇒ children 必须是 undefined；给空数组会让 TreeSelect 显示展开箭头
    expect(
      at(at(at(tree[0], 'tree[0]').children, 'children')[1], 'children[1]')
        .children,
    ).toBeUndefined();
  });

  it('有编码时 title 带编码（用于区分重名空间）', () => {
    const tree = toSpaceTree(sampleTree());
    const room = at(
      at(
        at(
          at(
            at(at(at(tree[0], 'tree[0]').children, 'children')[0], 'c0')
              .children,
            'c1',
          )[0],
          'c2',
        ).children,
        'c3',
      )[0],
      'room',
    );
    expect(room.title).toBe('101室（A-101）');
  });

  it('无编码时 title 就是名称', () => {
    const tree = toSpaceTree(sampleTree());
    expect(at(tree[0], 'tree[0]').title).toBe('总部园区');
  });

  it('leafOnly=true：非叶子节点 disabled，叶子可选', () => {
    const tree = toSpaceTree(sampleTree(), { leafOnly: true });
    expect(at(tree[0], 'tree[0]').disabled).toBe(true); // 园区有子节点
    expect(
      at(at(at(tree[0], 'tree[0]').children, 'children')[0], 'child0').disabled,
    ).toBe(true); // A栋
    // 101室 是叶子 ⇒ 可选
    const room = at(
      at(
        at(
          at(
            at(at(at(tree[0], 'tree[0]').children, 'children')[0], 'c0')
              .children,
            'c1',
          )[0],
          'c2',
        ).children,
        'c3',
      )[0],
      'room',
    );
    expect(room.disabled).toBe(false);
  });

  it('leafOnly=false：全部可选', () => {
    const tree = toSpaceTree(sampleTree());
    expect(at(tree[0], 'tree[0]').disabled).toBe(false);
    expect(
      at(at(at(tree[0], 'tree[0]').children, 'children')[0], 'child0').disabled,
    ).toBe(false);
  });

  it('★ excludeIds 必须连同子树一起排除（否则子节点成为「父不可见但可选」的孤儿）', () => {
    const tree = toSpaceTree(sampleTree(), { excludeIds: ['2'] });
    // A栋被排除后，B栋 应该顶到园区第二个位置
    expect(at(tree[0], 'tree[0]').children).toHaveLength(1);
    expect(
      at(at(at(tree[0], 'tree[0]').children, 'children')[0], 'child0').label,
    ).toBe('B栋');
    // 101室 不能以任何形式残留
    const json = JSON.stringify(tree);
    expect(json).not.toContain('101室');
    expect(json).not.toContain('1F');
  });

  it('★ leafOnly + excludeIds 组合：子节点被排除光的容器仍不可选', () => {
    // 这是最容易写错的一处：若用「转换后 children 长度」判定 leafOnly，
    // A栋（2）的子节点被排除后 children 变空 ⇒ 会被误判成叶子而可选，
    // 但 A栋 本是容器型空间（楼栋），选它等于把设备挂到「整栋楼」而不是具体房间。
    const tree = toSpaceTree(sampleTree(), {
      excludeIds: ['3', '4'],
      leafOnly: true,
    });
    const building = at(
      at(at(tree[0], 'tree[0]').children, 'children')[0],
      'building',
    );
    expect(building.label).toBe('A栋');
    expect(building.children).toBeUndefined();
    expect(building.disabled).toBe(true); // 关键断言：仍是容器 ⇒ 不可选
  });

  it('空输入返回空数组（不是 null）', () => {
    expect(toSpaceTree([])).toEqual([]);
    expect(toSpaceTree(undefined)).toEqual([]);
    expect(toSpaceTree(null)).toEqual([]);
  });

  it('后端返回 children: [] 与 children: undefined 都按叶子处理', () => {
    const withEmptyArray = [
      space('1', '空数组子节点', []),
      space('2', '无 children 字段'),
    ];
    const tree = toSpaceTree(withEmptyArray, { leafOnly: true });
    // 两者都没有真实子节点 ⇒ 都能选
    expect(at(tree[0], 'tree[0]').disabled).toBe(false);
    expect(at(tree[1], 'tree[1]').disabled).toBe(false);
    expect(at(tree[0], 'tree[0]').children).toBeUndefined();
  });
});

describe('collectSubtreeIds', () => {
  it('收集自身及全部后代 ID', () => {
    const ids = collectSubtreeIds(sampleTree(), '2');
    expect(ids.toSorted()).toEqual(['2', '3', '4']);
  });

  it('根节点收集整棵树', () => {
    const ids = collectSubtreeIds(sampleTree(), '1');
    expect(ids.toSorted()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('叶子节点只收集自己', () => {
    expect(collectSubtreeIds(sampleTree(), '4')).toEqual(['4']);
  });

  it('iD 不存在时返回空数组（调用方据此跳过排除逻辑）', () => {
    expect(collectSubtreeIds(sampleTree(), 'nonexistent')).toEqual([]);
  });

  it('空输入返回空数组', () => {
    expect(collectSubtreeIds(undefined, '1')).toEqual([]);
  });
});
