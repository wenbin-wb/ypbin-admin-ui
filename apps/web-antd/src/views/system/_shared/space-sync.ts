import type { SystemSpaceApi } from '#/api/system/space';

/**
 * 判断「本次提交的空间集合」相对「打开抽屉时回显的集合」是否发生变化。
 *
 * <h2>为什么需要一个独立的纯函数</h2>
 *
 * 部门表单（`dept/modules/form.vue`）与岗位表单（`post/modules/form.vue`）各自复制了一份
 * 同样的判定逻辑：`isCreate || length 不等 || some(不在原集合里)`。复制带来的不是「重复代码」
 * 这种美学问题，而是**两处口径会各自漂移**，且都挂在同一个后端接口（`/space/relations/sync`，
 * 要求 `system:space:bind` 权限）上——一处判错就会对没有该权限的角色发起 403。
 *
 * <h2>为什么「回显失败」必须是三态而不是空数组</h2>
 *
 * 空间关联的提交是**整体覆盖**语义（后端在一个事务里算差集增删），拿空数组提交等于「清空」。
 * 而抽屉打开时若回显接口失败（无 `system:space:list` 权限、网关超时），旧实现把
 * `originalSpaceIds` 留成 `[]` ⇒ 「没读到」与「本来就没有」在前端变成同一种状态 ⇒
 * 用户改个备注就被判定成「空间集合从空变成空」之外的任意变化，进而发出写请求。
 *
 * 故本函数用 `null` 显式表示「未知」，并对未知一律返回 `false`（不发起同步）——
 * 宁可这一次不更新关联，也不能在不知道自己原值的情况下覆盖它。
 *
 * @module views/system/_shared/space-sync
 */

/**
 * 判定空间集合是否变更。
 *
 * 比较口径：按**集合**比较（顺序无关、重复项自动去重），
 * 因为后端 `syncTargetSpaces` 收的就是「目标集合」，`['1','1']` 与 `['1']` 对它等价。
 *
 * @param original 打开抽屉时回显的集合；`null` 表示**回显失败/未知**（此时不判定为已变更）
 * @param next     本次提交的集合
 * @returns 需要调用 `/space/relations/sync` 时返回 `true`
 *
 * @example 仅改备注，空间未动
 * ```ts
 * isSpaceSetChanged(['1', '2'], ['1', '2']); // false ⇒ 不碰 system:space:bind 权限
 * ```
 *
 * @example 回显失败：绝不覆盖
 * ```ts
 * isSpaceSetChanged(null, []);      // false
 * isSpaceSetChanged(null, ['1']);   // false（不知道原值，不发起写请求）
 * ```
 *
 * @example 顺序变化不算变更、重复项不算变更
 * ```ts
 * isSpaceSetChanged(['1', '2'], ['2', '1']); // false
 * isSpaceSetChanged(['1'], ['1', '1']);      // false
 * ```
 */
export function isSpaceSetChanged(
  original: null | string[],
  next: string[],
): boolean {
  // 未知原值 ⇒ 不判定为变更（见模块注释：避免「不知道原值却覆盖」）
  if (original === null) {
    return false;
  }
  const before = new Set(original);
  const after = new Set(next);
  if (before.size !== after.size) {
    return true;
  }
  for (const id of after) {
    if (!before.has(id)) {
      return true;
    }
  }
  return false;
}

/**
 * 把回显得到的关联列表压成空间 ID 集合（含去重）。
 *
 * 抽出来是为了让调用方不必重复写 `.map(item => item.spaceId)`，
 * 且能统一处理后端可能返回的 `spaceId` 缺省值（`undefined`/`null` 直接丢弃）。
 *
 * @param relations 反查结果（`/space/relations/by-target` 的返回）
 * @returns 空间 ID 列表（顺序保留、已去重）
 */
export function spaceIdsFromRelations(
  relations: null | SystemSpaceApi.SpaceRelationResp[] | undefined,
): string[] {
  if (!relations || relations.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of relations) {
    const id = item?.spaceId;
    if (id === null || id === undefined || id === '') {
      continue;
    }
    const key = String(id);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    ids.push(key);
  }
  return ids;
}
