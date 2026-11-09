import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemBlocklistApi } from '#/api/system/blocklist';

import { $t } from '#/locales';

const MATCH_TYPE_I18N: Record<SystemBlocklistApi.MatchType, string> = {
  CIDR: 'system.blocklist.typeCidr',
  IP: 'system.blocklist.typeIp',
  PATH: 'system.blocklist.typePath',
  USER_AGENT: 'system.blocklist.typeUserAgent',
};

export function matchTypeLabel(type?: string) {
  if (!type) {
    return '';
  }
  return $t(
    MATCH_TYPE_I18N[type as SystemBlocklistApi.MatchType] ??
      'system.blocklist.matchType',
  );
}

export function matchTypeOptions() {
  return (Object.keys(MATCH_TYPE_I18N) as SystemBlocklistApi.MatchType[]).map(
    (value) => ({ label: matchTypeLabel(value), value }),
  );
}

export function useColumns(): VxeTableGridColumns {
  return [
    {
      field: 'matchType',
      title: $t('system.blocklist.matchType'),
      width: 150,
      slots: { default: 'matchType' },
    },
    {
      field: 'matchValue',
      title: $t('system.blocklist.matchValue'),
      minWidth: 220,
    },
    {
      field: 'reason',
      title: $t('system.blocklist.reason'),
      minWidth: 160,
    },
    {
      field: 'expireTime',
      title: $t('system.blocklist.expireTime'),
      width: 180,
      slots: { default: 'expireTime' },
    },
    {
      field: 'status',
      title: $t('system.blocklist.status'),
      width: 100,
      cellRender: { name: 'CellTag' },
    },
    {
      field: 'createTime',
      title: $t('system.blocklist.createTime'),
      width: 180,
    },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 150,
      slots: { default: 'action' },
    },
  ];
}

export function useAutoBanColumns(): VxeTableGridColumns {
  return [
    {
      field: 'clientIp',
      title: $t('system.blocklist.clientIp'),
      minWidth: 180,
    },
    {
      field: 'reason',
      title: $t('system.blocklist.reason'),
      minWidth: 220,
    },
    {
      field: 'expireTime',
      title: $t('system.blocklist.expireTime'),
      width: 180,
    },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 120,
      slots: { default: 'action' },
    },
  ];
}

export function useGridFormSchema(): FormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: matchTypeOptions(),
        placeholder: $t('system.blocklist.matchType'),
      },
      fieldName: 'matchType',
      label: $t('system.blocklist.matchType'),
    },
    {
      component: 'Input',
      componentProps: { allowClear: true },
      fieldName: 'matchValue',
      label: $t('system.blocklist.matchValue'),
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: $t('system.blocklist.statusEnabled'), value: 1 },
          { label: $t('system.blocklist.statusDisabled'), value: 0 },
        ],
      },
      fieldName: 'status',
      label: $t('system.blocklist.status'),
    },
  ];
}
