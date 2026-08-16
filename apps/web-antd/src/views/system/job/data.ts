import type { VbenFormSchema as FormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { z } from '#/adapter/form';
import { $t } from '#/locales';

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'name', title: $t('system.job.jobName'), minWidth: 150 },
    { field: 'executor', title: $t('system.job.executor'), minWidth: 150 },
    {
      field: 'cron',
      title: $t('system.job.scheduleRule'),
      minWidth: 180,
      slots: { default: 'scheduleRule' },
    },
    {
      field: 'concurrentGuard',
      title: $t('system.job.concurrentGuard'),
      width: 100,
    },
    {
      field: 'status',
      title: $t('system.job.status'),
      width: 100,
      cellRender: { name: 'CellTag' },
    },
    { field: 'createTime', title: $t('common.createTime'), width: 160 },
    {
      title: $t('common.action'),
      field: 'action',
      fixed: 'right',
      width: 240,
      align: 'center',
      slots: { default: 'action' },
    },
  ];
}

/**
 * 执行日志列配置。withJobName=true 时（汇总页）额外显示任务名列。
 */
export function useLogColumns(withJobName = false): VxeTableGridColumns {
  const cols: VxeTableGridColumns = [
    {
      field: 'triggerTime',
      title: $t('system.jobLog.triggerTime'),
      width: 170,
    },
    {
      field: 'outcome',
      title: $t('system.jobLog.outcome'),
      width: 100,
      cellRender: {
        name: 'CellTag',
        options: [
          {
            color: 'default',
            label: $t('system.jobLog.outcomeSkip'),
            value: 0,
          },
          {
            color: 'success',
            label: $t('system.jobLog.outcomeSuccess'),
            value: 1,
          },
          { color: 'error', label: $t('system.jobLog.outcomeFail'), value: 2 },
        ],
      },
    },
    {
      field: 'manual',
      title: $t('system.jobLog.manual'),
      width: 90,
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'processing', label: $t('system.jobLog.auto'), value: 0 },
          {
            color: 'warning',
            label: $t('system.jobLog.manualTrigger'),
            value: 1,
          },
        ],
      },
    },
    { field: 'durationMs', title: $t('system.jobLog.durationMs'), width: 110 },
    { field: 'errorMsg', title: $t('system.jobLog.errorMsg'), minWidth: 200 },
  ];
  if (withJobName) {
    cols.unshift({
      field: 'jobName',
      title: $t('system.job.jobName'),
      minWidth: 150,
    });
  }
  return cols;
}

export function useFormSchema(): FormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.job.jobName'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'executor',
      label: $t('system.job.executor'),
      rules: 'required',
    },
    {
      component: 'RadioGroup',
      fieldName: 'scheduleMode',
      label: $t('system.job.scheduleMode'),
      componentProps: {
        options: [
          { label: $t('system.job.scheduleModeCron'), value: 'cron' },
          {
            label: $t('system.job.scheduleModeFixedRate'),
            value: 'fixedRate',
          },
        ],
      },
      defaultValue: 'cron',
    },
    {
      component: 'Input',
      dependencies: {
        show: (values) => values.scheduleMode === 'cron',
        triggerFields: ['scheduleMode'],
      },
      fieldName: 'cron',
      label: $t('system.job.cron'),
      defaultValue: '0 0 0 * * ?',
      formItemClass: 'items-start',
    },
    {
      component: 'InputNumber',
      componentProps: { min: 1, precision: 0 },
      dependencies: {
        show: (values) => values.scheduleMode === 'fixedRate',
        triggerFields: ['scheduleMode'],
      },
      fieldName: 'fixedRateSeconds',
      label: $t('system.job.fixedRateSeconds'),
      rules: z
        .number({ error: $t('system.job.fixedRatePositive') })
        .int($t('system.job.fixedRatePositive'))
        .positive($t('system.job.fixedRatePositive'))
        .optional(),
    },
    {
      component: 'InputNumber',
      fieldName: 'timeoutSeconds',
      label: $t('system.job.timeoutSeconds'),
      defaultValue: 0,
    },
    {
      component: 'RadioGroup',
      fieldName: 'concurrentGuard',
      label: $t('system.job.concurrentGuard'),
      componentProps: {
        options: [
          { label: $t('common.yes'), value: 1 },
          { label: $t('common.no'), value: 0 },
        ],
      },
      defaultValue: 1,
    },
    { component: 'Input', fieldName: 'args', label: $t('system.job.args') },
  ];
}
