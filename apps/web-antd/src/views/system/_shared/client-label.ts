import { $t } from '#/locales';

/**
 * 登录客户端标签：clientId → 可读名称。
 *
 * 值来自 `sys_client`，是后台可扩展的配置而不是固定枚举；未登记的 clientId
 * 由 `CellTag` 渲染器回退显示原值，新增客户端不需要改前端。
 */
export function clientTagOptions() {
  return [
    {
      color: 'processing',
      label: $t('system.client.labelWebAdmin'),
      value: 'web-admin',
    },
    {
      color: 'success',
      label: $t('system.client.labelMiniapp'),
      value: 'miniapp',
    },
  ];
}

/**
 * 客户端展示名：已知 ID 返回可读名称，未知 ID 原样返回，空值返回空串。
 *
 * @param clientId 客户端 ID
 */
export function clientLabel(clientId?: null | string): string {
  if (!clientId) {
    return '';
  }
  return (
    clientTagOptions().find((item) => item.value === clientId)?.label ??
    clientId
  );
}

/**
 * 客户端集合展示名：逗号分隔的 ID 集合 → 可读名称，用顿号连接；空集返回空串。
 *
 * @param clientIds 逗号分隔的客户端 ID 集合
 */
export function clientLabels(clientIds?: null | string): string {
  if (!clientIds) {
    return '';
  }
  return clientIds
    .split(',')
    .map((clientId) => clientLabel(clientId.trim()))
    .filter(Boolean)
    .join('、');
}
