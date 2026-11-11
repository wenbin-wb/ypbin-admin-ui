/**
 * 埋点筛选视图的本地持久化。
 *
 * <p>视图是个人排障习惯（如「近 1 小时失败」「某条业务链路」），不需要跨用户共享，
 * 也不值得为它建表与接口，因此存在浏览器 localStorage：与后端无耦合、换设备不迁移。</p>
 */
export interface SavedFilterView {
  /** 视图 ID（本地生成，仅用于列表 key 与删除） */
  id: string;
  /** 视图名称（用户输入） */
  name: string;
  /** 保存时的筛选表单值（字段名与查询条件一致） */
  filters: Record<string, unknown>;
}

/** 存储键：带版本号，字段结构变化时直接换键，避免读到旧结构 */
const STORAGE_KEY = 'ypbin:tracking:event-views:v1';

/** 最多保存的视图数（超限时拒绝保存，而不是静默淘汰别人的视图） */
export const MAX_SAVED_VIEWS = 10;

/**
 * 读取本地视图。
 *
 * <p>解析失败或结构不合法时返回空数组并打日志：本地缓存损坏不应让整个页面打不开，
 * 但也不能静默当成"没有保存过"——日志保留可追溯性。</p>
 *
 * @return 视图列表（旧→新）
 */
export function loadSavedViews(): SavedFilterView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error('Saved tracking views is not an array, fallback to empty.');
      return [];
    }
    return parsed.filter((item) => isSavedView(item));
  } catch (error) {
    console.error('Failed to load saved tracking views:', error);
    return [];
  }
}

/**
 * 写回本地视图。
 *
 * @param views 视图列表
 */
export function persistSavedViews(views: SavedFilterView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

/**
 * 生成一个视图（调用方已完成名称校验）。
 *
 * @param name    视图名称
 * @param filters 筛选表单值
 * @return 新视图
 */
export function createSavedView(
  name: string,
  filters: Record<string, unknown>,
): SavedFilterView {
  return {
    filters,
    id:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
  };
}

function isSavedView(value: unknown): value is SavedFilterView {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const view = value as Partial<SavedFilterView>;
  return (
    typeof view.id === 'string' &&
    typeof view.name === 'string' &&
    typeof view.filters === 'object' &&
    view.filters !== null
  );
}
