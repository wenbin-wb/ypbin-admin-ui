/**
 * 强制改密状态（登录响应 `mustChangePassword` 为 true 时置位）。
 *
 * 用 localStorage 而不是内存变量：登录后刷新页面仍需被拦在改密页；
 * 改密成功或登出时清除。后端同时会用会话标记拦截除改密/登出/身份查询外的接口，
 * 前端这里只负责「把用户带到正确的页面」。
 */
export const CHANGE_PASSWORD_PATH = '/auth/change-password';

const STORAGE_KEY = 'ypbin.must-change-password';

/** 标记「必须先改密」 */
export function markMustChangePassword(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // 存储不可用（隐私模式/配额满）时退化为仅本次会话内由路由守卫判断；
    // 不阻断登录流程，接口侧仍会拦截
  }
}

/** 清除「必须先改密」标记 */
export function clearMustChangePassword(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上：存储不可用时无需清理
  }
}

/** 当前是否处于「必须先改密」状态 */
export function isMustChangePassword(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
