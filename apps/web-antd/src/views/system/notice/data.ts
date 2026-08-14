import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { $t } from '#/locales';

/** 通知范围选项 */
export function getScopeOptions() {
  return [
    { label: $t('system.notice.scopeAll'), value: 1 },
    { label: $t('system.notice.scopeRole'), value: 2 },
    { label: $t('system.notice.scopeDept'), value: 3 },
    { label: $t('system.notice.scopeUser'), value: 4 },
  ];
}

/** 发布状态选项（含颜色，供列表标签渲染） */
export function getPublishStatusOptions() {
  return [
    { color: 'default', label: $t('system.notice.statusDraft'), value: 0 },
    { color: 'processing', label: $t('system.notice.statusPending'), value: 1 },
    { color: 'success', label: $t('system.notice.statusPublished'), value: 2 },
    { color: 'error', label: $t('system.notice.statusRevoked'), value: 3 },
  ];
}

export function useColumns(): VxeTableGridColumns {
  return [
    {
      field: 'isTop',
      title: $t('system.notice.isTop'),
      width: 70,
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'default', label: '', value: 0 },
          { color: 'error', label: $t('system.notice.isTop'), value: 1 },
        ],
      },
    },
    { field: 'title', title: $t('system.notice.title'), minWidth: 180 },
    {
      field: 'noticeType',
      title: $t('system.notice.noticeType'),
      width: 100,
      cellRender: {
        name: 'CellTag',
        options: [
          {
            color: 'processing',
            label: $t('system.notice.typeNotice'),
            value: 1,
          },
          {
            color: 'warning',
            label: $t('system.notice.typeAnnouncement'),
            value: 2,
          },
        ],
      },
    },
    {
      field: 'noticeScope',
      title: $t('system.notice.scope'),
      width: 100,
      cellRender: { name: 'CellTag', options: getScopeOptions() },
    },
    {
      field: 'publishStatus',
      title: $t('system.notice.publishStatus'),
      width: 100,
      cellRender: { name: 'CellTag', options: getPublishStatusOptions() },
    },
    { field: 'createUserName', title: $t('common.creator'), width: 100 },
    {
      field: 'publishTime',
      title: $t('system.notice.publishTime'),
      width: 160,
    },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 280,
      align: 'center',
      slots: { default: 'action' },
    },
  ];
}

export function useGridFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('system.notice.title'),
      componentProps: { allowClear: true },
    },
    {
      component: 'Select',
      fieldName: 'publishStatus',
      label: $t('system.notice.publishStatus'),
      componentProps: { allowClear: true, options: getPublishStatusOptions() },
    },
  ];
}

export function useFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'title',
      label: $t('system.notice.title'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      fieldName: 'noticeType',
      label: $t('system.notice.noticeType'),
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: $t('system.notice.typeNotice'), value: 1 },
          { label: $t('system.notice.typeAnnouncement'), value: 2 },
        ],
      },
      defaultValue: 1,
    },
    {
      component: 'Switch',
      fieldName: 'isTop',
      label: $t('system.notice.isTop'),
      defaultValue: 0,
      componentProps: { checkedValue: 1, unCheckedValue: 0 },
    },
    {
      component: 'Select',
      fieldName: 'noticeScope',
      label: $t('system.notice.scope'),
      componentProps: { options: getScopeOptions() },
      defaultValue: 1,
    },
    {
      component: 'Input',
      fieldName: 'scopeTargetIds',
      label: $t('system.notice.scopeTargets'),
      componentProps: {
        allowClear: true,
        placeholder: 'ID1,ID2,...',
      },
      dependencies: {
        show: (values) => values.noticeScope !== 1,
        triggerFields: ['noticeScope'],
      },
    },
    {
      component: 'CheckboxGroup',
      fieldName: 'notifyMethods',
      label: $t('system.notice.notifyMethods'),
      componentProps: {
        options: [
          { label: $t('system.notice.methodSite'), value: 'site' },
          { label: $t('system.notice.methodEmail'), value: 'email' },
          { label: $t('system.notice.methodSms'), value: 'sms' },
        ],
      },
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      fieldName: 'publishType',
      label: $t('system.notice.publishType'),
      componentProps: {
        buttonStyle: 'solid',
        optionType: 'button',
        options: [
          { label: $t('system.notice.publishNow'), value: 1 },
          { label: $t('system.notice.publishScheduled'), value: 2 },
        ],
      },
      defaultValue: 1,
    },
    {
      component: 'DatePicker',
      fieldName: 'scheduledTime',
      label: $t('system.notice.scheduledTime'),
      componentProps: { showTime: true, valueFormat: 'YYYY-MM-DD HH:mm:ss' },
      dependencies: {
        show: (values) => values.publishType === 2,
        triggerFields: ['publishType'],
      },
    },
    {
      component: 'DatePicker',
      fieldName: 'effectiveTime',
      label: $t('system.notice.effectiveTime'),
      componentProps: { showTime: true, valueFormat: 'YYYY-MM-DD HH:mm:ss' },
    },
    {
      component: 'DatePicker',
      fieldName: 'expireTime',
      label: $t('system.notice.expireTime'),
      componentProps: { showTime: true, valueFormat: 'YYYY-MM-DD HH:mm:ss' },
    },
    {
      component: 'Input',
      fieldName: 'cover',
      label: $t('system.notice.cover'),
      formItemClass: 'items-start',
    },
    {
      component: 'RichEditor',
      fieldName: 'content',
      label: $t('system.notice.content'),
      formItemClass: 'items-start',
      componentProps: {
        placeholder: $t('system.notice.contentPlaceholder'),
      },
    },
  ];
}
