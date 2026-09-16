import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

/**
 * 空值占位。
 *
 * `ip` / `deviceType` / `location` / `browser` / `os` 都可能为空（登录终端信息缺失时
 * 后端不填），留空会让人误以为表格没渲染出来，故统一显示为短横线。
 */
const EMPTY_TEXT = '-';

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'token', title: $t('system.onlineUser.token'), minWidth: 200 },
    {
      field: 'realName',
      title: $t('system.user.realName'),
      minWidth: 120,
    },
    { field: 'username', title: $t('system.onlineUser.username'), width: 120 },
    {
      field: 'ip',
      title: $t('system.onlineUser.ip'),
      width: 140,
      formatter: ({ cellValue }) => cellValue || EMPTY_TEXT,
    },
    {
      field: 'deviceType',
      title: $t('system.onlineUser.deviceType'),
      width: 120,
      // 后端存的是登录客户端类型（starter 侧统一转小写后写入 Sa-Token 终端信息，
      // 客户端类型缺失时为字面量 "WEB"），前端只做占位、不做枚举映射：
      // 该值来自可配置的客户端定义，不是受限字典，硬编码中文标签会与后端漂移
      formatter: ({ cellValue }) => cellValue || EMPTY_TEXT,
    },
    { field: 'location', title: $t('system.log.location'), width: 120 },
    { field: 'browser', title: $t('system.log.browser'), minWidth: 160 },
    { field: 'os', title: 'OS', minWidth: 140 },
    {
      field: 'loginTime',
      title: $t('system.onlineUser.loginTime'),
      width: 160,
    },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 100,
      slots: { default: 'action' },
    },
  ];
}

export function useGridFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'keyword',
      label: $t('common.keyword'),
      componentProps: { allowClear: true },
    },
  ];
}
