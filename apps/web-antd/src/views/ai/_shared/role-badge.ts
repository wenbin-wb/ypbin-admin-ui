/** 角色分类徽章映射（析/码/自/译/写），chat 与 role 列表共用 */

export interface RoleBadge {
  /** 徽章字符（分类首字） */
  char: string;
  /** 徽章样式类名 */
  cls: string;
}

const ROLE_BADGES: Record<string, RoleBadge> = {
  analyst: { char: '析', cls: 'role-analyst' },
  coder: { char: '码', cls: 'role-coder' },
  custom: { char: '自', cls: 'role-custom' },
  translator: { char: '译', cls: 'role-translator' },
  writer: { char: '写', cls: 'role-writer' },
};

const DEFAULT_BADGE: RoleBadge = { char: 'AI', cls: 'role-assistant' };

/** 根据角色分类取徽章；未知分类回退通用助手徽章 */
export function roleBadge(category?: string): RoleBadge {
  return ROLE_BADGES[category ?? ''] ?? DEFAULT_BADGE;
}
