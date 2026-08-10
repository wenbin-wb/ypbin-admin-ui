<script lang="ts" setup>
import type { SystemJobApi } from '#/api/system/job';

import { nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createJob, updateJob } from '#/api/system/job';
import { $t } from '#/locales';

import CronInput from '../../_shared/cron-input.vue';
import { useFormSchema } from '../data';

type JobFormData = null | SystemJobApi.JobResp;
type ScheduleMode = 'cron' | 'fixedRate';

interface JobFormValues extends Record<string, unknown> {
  args?: string;
  concurrentGuard: number;
  cron?: string;
  executor: string;
  fixedRateSeconds?: number;
  name: string;
  scheduleMode: ScheduleMode;
  timeoutSeconds: number;
}

const emit = defineEmits(['reload']);
const rowId = ref('');
const cronInputRef = ref<InstanceType<typeof CronInput>>();

const [Form, formApi] = useVbenForm({
  handleValuesChange(values, fieldsChanged) {
    if (!fieldsChanged.includes('scheduleMode')) {
      return;
    }
    if (values.scheduleMode === 'cron') {
      formApi.setFieldValue('fixedRateSeconds', undefined);
    } else {
      formApi.setFieldValue('cron', undefined);
    }
  },
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<JobFormData>({
  onCancel() {
    drawerApi.close();
  },
  async onConfirm() {
    try {
      drawerApi.setState({ confirmLoading: true });
      const { valid } = await formApi.validate();
      if (!valid) {
        return;
      }
      const values = (await formApi.getValues()) as JobFormValues;
      const hasCron = Boolean(values.cron?.trim());
      const hasFixedRate = (values.fixedRateSeconds ?? null) !== null;
      if (hasCron === hasFixedRate) {
        message.error($t('system.job.scheduleRuleXor'));
        return;
      }
      if (values.scheduleMode === 'cron') {
        const cronValid = await cronInputRef.value?.validate();
        if (!cronValid) {
          return;
        }
      }
      const data: SystemJobApi.JobSaveReq = {
        args: values.args,
        concurrentGuard: values.concurrentGuard,
        cron: values.scheduleMode === 'cron' ? values.cron?.trim() : undefined,
        executor: values.executor,
        fixedRateSeconds:
          values.scheduleMode === 'fixedRate' &&
          (values.fixedRateSeconds ?? null) !== null
            ? String(values.fixedRateSeconds)
            : undefined,
        name: values.name,
        timeoutSeconds:
          (values.timeoutSeconds ?? null) === null
            ? undefined
            : String(values.timeoutSeconds),
      };
      await (rowId.value ? updateJob(rowId.value, data) : createJob(data));
      message.success($t('common.success'));
      drawerApi.close();
      emit('reload');
    } finally {
      drawerApi.setState({ confirmLoading: false });
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      return;
    }
    const data = drawerApi.getData();
    rowId.value = data?.id ?? '';
    drawerApi.setState({
      title: rowId.value
        ? $t('ui.actionTitle.edit', [$t('system.job.title')])
        : $t('ui.actionTitle.create', [$t('system.job.title')]),
    });
    formApi.reset();
    await nextTick();
    const scheduleMode: ScheduleMode =
      (data?.fixedRateSeconds ?? null) === null ? 'cron' : 'fixedRate';
    await formApi.setValues(
      data
        ? {
            ...data,
            fixedRateSeconds:
              (data.fixedRateSeconds ?? null) === null
                ? undefined
                : Number(data.fixedRateSeconds),
            scheduleMode,
            timeoutSeconds:
              (data.timeoutSeconds ?? null) === null
                ? undefined
                : Number(data.timeoutSeconds),
          }
        : {
            concurrentGuard: 1,
            cron: '0 0 0 * * ?',
            scheduleMode,
            timeoutSeconds: 0,
          },
    );
  },
});

defineExpose({ drawerApi });
</script>
<template>
  <Drawer class="w-[700px]">
    <Form>
      <template #cron="slotProps">
        <CronInput ref="cronInputRef" v-bind="slotProps.componentField" />
      </template>
    </Form>
  </Drawer>
</template>
