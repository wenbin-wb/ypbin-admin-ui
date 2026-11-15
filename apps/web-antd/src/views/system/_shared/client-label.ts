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
