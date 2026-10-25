import type { SystemSpaceApi } from '#/api/system/space';

/**
 * 空间树选择器所需的节点结构（Ant Design Vue TreeSelect 的 treeData 元素）。
 */
export interface SpaceTreeNode {
  children?: SpaceTreeNode[];
  disabled?: boolean;
  label: string;
  /** 悬浮提示：带上编码，用于区分重名空间（多处「101 室」） */
  title: string;
  value: string;
}

export interface ToTreeOptions {
  /**
   * 只允许选中叶子空间。
   *
   * 设备/人员通常要精确到房间 ⇒ 置 true；部门可以是整栋楼 ⇒ false。
   * 非叶子节点**仍然展示**（便于浏览下钻），只是标记 disabled。
   */
  leafOnly?: boolean;
  /** 需要排除的空间 ID（连同其子树一起排除，如编辑时排除自身） */
  excludeIds?: string[];
}

/**
 * 把后端空间树转成 TreeSelect 的 treeData。
 *
 * 抽成纯函数而不是写在组件里，是因为它有两条容易出错、且**在页面上看不出来**的规则：
 * 1. `leafOnly` 必须按「转换后的子节点是否为空」判定——后端返回的 `children` 叶子可能是
 *    `undefined`，也可能是空数组（历史接口两种都给过），只判其中一种会漏；
 * 2. `excludeIds` 必须**连同子树一起**排除——只排除节点本身会让它的子节点变成孤儿，
 *    用户能选到一个「父节点不可见但自己可见」的空间。
 */
export function toSpaceTree(
  nodes: null | SystemSpaceApi.SpaceResp[] | undefined,
  options: ToTreeOptions = {},
): SpaceTreeNode[] {
  const exclude = new Set(options.excludeIds);
  const leafOnly = options.leafOnly ?? false;

  const walk = (
    list: null | SystemSpaceApi.SpaceResp[] | undefined,
  ): SpaceTreeNode[] => {
    if (!list || list.length === 0) {
      return [];
    }
    const result: SpaceTreeNode[] = [];
    for (const node of list) {
      if (exclude.has(node.id)) {
        // 连同子树一起跳过：否则子节点会成为「父不可见但可选」的孤儿
        continue;
      }
      const children = walk(node.children);
      result.push({
        children: children.length > 0 ? children : undefined,
        // 只有「原本没有子节点」的才是合法叶子；有子节点时即使子节点被排除光，
        // 也不该变成可选（否则用户能选到「A 栋」这种容器型空间）
        disabled: leafOnly && (node.children?.length ?? 0) > 0,
        label: node.name,
        title: node.code ? `${node.name}（${node.code}）` : node.name,
        value: node.id,
      });
    }
    return result;
  };

  return walk(nodes);
}

/**
 * 收集树中全部节点 ID（用于「排除自身及子树」时先算出排除集）。
 *
 * 与 {@link toSpaceTree} 分开是因为调用时机不同：编辑空间时先要知道「自身 + 后代」，
 * 再把它传给选择器的 `excludeIds`。
 */
export function collectSubtreeIds(
  nodes: null | SystemSpaceApi.SpaceResp[] | undefined,
  rootId: string,
): string[] {
  const ids: string[] = [];
  const walk = (
    list: null | SystemSpaceApi.SpaceResp[] | undefined,
    collecting: boolean,
  ): void => {
    if (!list) {
      return;
    }
    for (const node of list) {
      const hit = collecting || node.id === rootId;
      if (hit) {
        ids.push(node.id);
      }
      walk(node.children, hit);
    }
  };
  walk(nodes, false);
  return ids;
}

/**
 * 懒加载节点 → vxe 表格行。
 *
 * **关键：`children` 必须是 `undefined`（不是 `[]`）**。
 * vxe 的 lazy 树用「`children` 为 undefined」表示「尚未加载」，用户展开时才调 `loadMethod`；
 * 若给空数组，vxe 会认为「已加载且没有子节点」⇒ 永远不再请求 ⇒ 树展不开。
 *
 * <p>抽成纯函数是为了能单测这条规则：它写错了不会报错、不会红任何既有用例，
 * 只表现为「树点了不展开」——而那个现象很容易被误判成后端接口问题。</p>
 *
 * @param node 后端返回的懒加载节点
 * @returns 可直接交给 vxe 的行对象
 */
export function toLazyRow<T extends { children?: T[]; hasChildren: boolean }>(
  node: T,
): T {
  // 有子节点 ⇒ 显式置 undefined（触发 vxe 的「未加载」判定）；
  // 无子节点 ⇒ 保持原样（vxe 视为叶子，不显示展开箭头）
  return node.hasChildren ? { ...node, children: undefined } : { ...node };
}
