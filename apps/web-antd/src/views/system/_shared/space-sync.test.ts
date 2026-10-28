import type { SystemSpaceApi } from '#/api/system/space';

import { describe, expect, it } from 'vitest';

import { isSpaceSetChanged, spaceIdsFromRelations } from './space-sync';

describe('isSpaceSetChanged（空间集合变更判定）', () => {
  describe('★ 回显失败（unknown）时不发起同步', () => {
    it('原值未知 + 提交空集合 ⇒ false（不覆盖）', () => {
      // 场景：抽屉打开时 /space/relations/by-target 失败 ⇒ original 为 null。
      // 若这里返回 true，会对没有 system:space:bind 权限的角色发起 403，
      // 甚至在权限足够时用空数组把已有绑定整体清空。
      expect(isSpaceSetChanged(null, [])).toBe(false);
    });

    it('原值未知 + 提交非空集合 ⇒ false（宁可这次不更新，也不能不知道原值就覆盖）', () => {
      expect(isSpaceSetChanged(null, ['1', '2'])).toBe(false);
    });
  });

  describe('真实变更', () => {
    it('新增一个 ⇒ true', () => {
      expect(isSpaceSetChanged(['1'], ['1', '2'])).toBe(true);
    });

    it('删除一个 ⇒ true', () => {
      expect(isSpaceSetChanged(['1', '2'], ['1'])).toBe(true);
    });

    it('换一个（数量不变）⇒ true', () => {
      expect(isSpaceSetChanged(['1'], ['2'])).toBe(true);
    });

    it('清空 ⇒ true（这是合法的「解除全部关联」，必须允许发起）', () => {
      expect(isSpaceSetChanged(['1', '2'], [])).toBe(true);
    });

    it('空 → 非空 ⇒ true', () => {
      expect(isSpaceSetChanged([], ['9'])).toBe(true);
    });
  });

  describe('不算变更（避免无谓地触碰 system:space:bind 权限）', () => {
    it('完全相同 ⇒ false', () => {
      expect(isSpaceSetChanged(['1', '2'], ['1', '2'])).toBe(false);
    });

    it('顺序不同 ⇒ false', () => {
      expect(isSpaceSetChanged(['1', '2'], ['2', '1'])).toBe(false);
    });

    it('重复项 ⇒ false（后端收的是集合，[1,1] 与 [1] 等价）', () => {
      expect(isSpaceSetChanged(['1'], ['1', '1'])).toBe(false);
    });

    it('两边都空 ⇒ false', () => {
      expect(isSpaceSetChanged([], [])).toBe(false);
    });
  });
});

describe('spaceIdsFromRelations（反查结果 → 空间 ID 集合）', () => {
  function rel(spaceId: string): SystemSpaceApi.SpaceRelationResp {
    return {
      id: `rel-${spaceId}`,
      isPrimary: 0,
      spaceId,
      targetId: 't1',
      targetType: 'dept',
    };
  }

  it('空/undefined ⇒ 空数组（不是 null）', () => {
    expect(spaceIdsFromRelations(undefined)).toEqual([]);
    expect(spaceIdsFromRelations(null)).toEqual([]);
    expect(spaceIdsFromRelations([])).toEqual([]);
  });

  it('保留顺序并去重', () => {
    expect(spaceIdsFromRelations([rel('2'), rel('1'), rel('2')])).toEqual([
      '2',
      '1',
    ]);
  });

  it('丢弃空 spaceId（后端异常数据不应让整条回显失败）', () => {
    const broken = [
      rel('1'),
      { ...rel('x'), spaceId: '' },
      { ...rel('y'), spaceId: undefined as unknown as string },
    ] as SystemSpaceApi.SpaceRelationResp[];
    expect(spaceIdsFromRelations(broken)).toEqual(['1']);
  });
});
