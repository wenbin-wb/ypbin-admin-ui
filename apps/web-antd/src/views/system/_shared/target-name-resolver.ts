/**
 * 空间关联「对象显示名」解析器注册表。
 *
 * <h2>为什么需要这层间接</h2>
 *
 * 空间关联抽屉（`views/system/space/modules/relation-drawer.vue`）属**基础模块**，
 * 而它要展示的对象名分散在各业务域：设备名在 IoT、部门名/用户名在 system。
 *
 * 基础模块**不能** import 业务域 API —— `ypbin-admin-ui` 仓里根本没有 `api/iot`，
 * 一旦 import 就会让 admin-ui 编译失败（两仓的 `space/list.vue` 逐字节相同）。
 *
 * 故做成**注册表**：业务域在自己仓的启动阶段注册解析器，基础模块只查表。
 * 没注册时退化为显示 ID，基础模块单独使用不受影响。
 *
 * <h2>与「往抽屉传 prop」的区别</h2>
 *
 * 传 prop 要求**每个调用点**都知道自己有哪些业务域——空间列表页在两仓是同一份代码，
 * 无法在 iot-ui 里写设备解析、在 admin-ui 里不写。注册表把「谁提供解析」下沉到
 * 各仓的启动代码，调用点保持零差异。
 *
 * @module views/system/_shared/target-name-resolver
 */

/**
 * 设备对象类型（与 system 字典 `space_target_type` 的 `device` 项值一致）。
 *
 * <p>抽成常量而不是各处写 `'device'` 字面量：字典项值改动时只需改这里，
 * 且拼错会变成编译错误而不是「静默取不到名」。</p>
 */
export const TARGET_TYPE_DEVICE = 'device';

/** 解析器：把「对象类型 + ID 列表」解析成 ID → 显示名 */
export type TargetNameResolver = (
  targetType: string,
  ids: string[],
) => Promise<Record<string, string>>;

/**
 * 已注册的解析器（按对象类型索引）。
 *
 * 用 `Map` 而非普通对象：避免 `constructor`/`__proto__` 这类键污染原型链。
 */
const resolvers = new Map<string, TargetNameResolver>();

/**
 * 注册某对象类型的显示名解析器。
 *
 * @param targetType 对象类型（与字典 `space_target_type` 的项值一致，如 `device`）
 * @param resolver   解析器实现
 */
export function registerTargetNameResolver(
  targetType: string,
  resolver: TargetNameResolver,
): void {
  resolvers.set(targetType, resolver);
}

/**
 * 取某对象类型的解析器。
 *
 * @param targetType 对象类型
 * @returns 解析器；未注册时 `undefined`（调用方应退化为显示 ID）
 */
export function getTargetNameResolver(
  targetType: string,
): TargetNameResolver | undefined {
  return resolvers.get(targetType);
}

/**
 * 是否已注册任何解析器（供测试与调试判断）。
 *
 * @returns 已注册的解析器数量
 */
export function registeredResolverCount(): number {
  return resolvers.size;
}

/**
 * 清空注册表（**仅供测试**：避免用例间相互污染）。
 */
export function clearTargetNameResolvers(): void {
  resolvers.clear();
}
