import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SystemLicenseApi } from '#/api/system/license';

import { getTenantList } from '#/api/system/tenant';
import { $t } from '#/locales';

/** 审批状态选项（含标签色，供 CellTag 与筛选下拉复用） */
export function getApproveStatusOptions() {
  return [
    {
      label: $t('system.license.statusDraft'),
      value: 'DRAFT',
      color: 'default',
    },
    {
      label: $t('system.license.statusPending'),
      value: 'PENDING',
      color: 'processing',
    },
    {
      label: $t('system.license.statusIssued'),
      value: 'ISSUED',
      color: 'success',
    },
    {
      label: $t('system.license.statusRejected'),
      value: 'REJECTED',
      color: 'error',
    },
    {
      label: $t('system.license.statusRevoked'),
      value: 'REVOKED',
      color: 'warning',
    },
  ];
}

/** 交付模式选项 */
export function getDeliveryModeOptions() {
  return [
    { label: $t('system.license.deliveryModeCode'), value: 'CODE' },
    { label: $t('system.license.deliveryModeFile'), value: 'FILE' },
  ];
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'subject',
      label: $t('system.license.subject'),
      componentProps: { placeholder: $t('system.license.subjectPlaceholder') },
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      fieldName: 'deliveryMode',
      label: $t('system.license.deliveryMode'),
      help: $t('system.license.deliveryModeTip'),
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: getDeliveryModeOptions(),
      },
      defaultValue: 'CODE',
      rules: 'required',
    },
    {
      component: 'ApiSelect',
      fieldName: 'tenantId',
      label: $t('system.license.tenantId'),
      help: $t('system.license.tenantIdTip'),
      componentProps: {
        api: getTenantList,
        labelField: 'name',
        valueField: 'id',
        allowClear: true,
        class: 'w-full',
        optionLabelProp: 'label',
      },
    },
    {
      component: 'DatePicker',
      fieldName: 'effectiveAt',
      label: $t('system.license.effectiveAt'),
      componentProps: {
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
        class: 'w-full',
      },
    },
    {
      component: 'DatePicker',
      fieldName: 'expireAt',
      label: $t('system.license.expireAt'),
      help: $t('system.license.expireAtTip'),
      componentProps: {
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
        class: 'w-full',
      },
    },
    {
      component: 'InputNumber',
      fieldName: 'graceDays',
      label: $t('system.license.graceDays'),
      help: $t('system.license.graceDaysTip'),
      componentProps: { min: 0, precision: 0 },
      defaultValue: 0,
    },
    {
      component: 'Select',
      fieldName: 'fingerprints',
      label: $t('system.license.fingerprints'),
      help: $t('system.license.fingerprintsTip'),
      componentProps: {
        mode: 'tags',
        open: false,
        tokenSeparators: [',', ' '],
        class: 'w-full',
      },
    },
    {
      component: 'Select',
      fieldName: 'modules',
      label: $t('system.license.modules'),
      help: $t('system.license.modulesTip'),
      componentProps: {
        mode: 'tags',
        open: false,
        tokenSeparators: [',', ' '],
        class: 'w-full',
      },
    },
    {
      component: 'Input',
      fieldName: 'quotas',
      label: $t('system.license.quotas'),
      help: $t('system.license.quotasTip'),
      formItemClass: 'items-start',
      modelPropName: 'modelValue',
    },
    {
      component: 'Input',
      fieldName: 'attributes',
      label: $t('system.license.attributes'),
      help: $t('system.license.attributesTip'),
      formItemClass: 'items-start',
      modelPropName: 'modelValue',
    },
    {
      component: 'Textarea',
      fieldName: 'remark',
      label: $t('system.license.remark'),
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'subject',
      label: $t('system.license.subject'),
    },
    {
      component: 'Select',
      fieldName: 'approveStatus',
      label: $t('system.license.approveStatus'),
      componentProps: {
        allowClear: true,
        options: getApproveStatusOptions(),
      },
    },
    {
      component: 'ApiSelect',
      fieldName: 'tenantId',
      label: $t('system.license.tenantId'),
      componentProps: {
        api: getTenantList,
        labelField: 'name',
        valueField: 'id',
        allowClear: true,
        class: 'w-full',
        optionLabelProp: 'label',
      },
    },
  ];
}

export function useColumns(): VxeTableGridColumns<SystemLicenseApi.SystemLicense> {
  return [
    {
      field: 'subject',
      title: $t('system.license.subject'),
      minWidth: 160,
    },
    {
      field: 'licenseId',
      title: $t('system.license.licenseId'),
      width: 280,
      slots: { default: 'licenseId' },
    },
    {
      field: 'deliveryMode',
      title: $t('system.license.deliveryMode'),
      width: 110,
      cellRender: { name: 'CellTag', options: getDeliveryModeOptions() },
    },
    {
      field: 'approveStatus',
      title: $t('system.license.approveStatus'),
      width: 110,
      cellRender: { name: 'CellTag', options: getApproveStatusOptions() },
    },
    {
      field: 'currentStatus',
      title: $t('system.license.currentStatus'),
      width: 150,
    },
    {
      field: 'expireAt',
      title: $t('system.license.expireAt'),
      width: 170,
    },
    {
      field: 'tenantId',
      title: $t('system.license.tenantId'),
      width: 120,
    },
    {
      field: 'createUserName',
      title: $t('common.creator'),
      width: 110,
    },
    {
      field: 'createTime',
      title: $t('system.license.createTime'),
      width: 170,
    },
    {
      align: 'center',
      title: $t('system.license.operation'),
      field: 'action',
      fixed: 'right',
      width: 280,
      slots: { default: 'action' },
    },
  ];
}
