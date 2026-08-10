<script lang="ts" setup>
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createDept, updateDept } from '#/api/system/dept';
import { $t } from '#/locales';

import { useSchema } from '../data';

const emit = defineEmits(['success']);
type DeptFormData = null | Partial<SystemDeptApi.SystemDept>;

const formData = ref<Partial<SystemDeptApi.SystemDept>>();
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.dept.name')])
    : $t('ui.actionTitle.create', [$t('system.dept.name')]);
});

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: useSchema(),
  showDefaultActions: false,
});

function resetForm() {
  formApi.reset();
  formApi.setValues(formData.value || {});
}

const [Drawer, drawerApi] = useVbenDrawer<DeptFormData>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (valid) {
      drawerApi.lock();
      const values = await formApi.getValues<{
        email?: string;
        leader?: string;
        name: string;
        phone?: string;
        pid?: string;
        remark?: string;
        sort?: number;
        status: 0 | 1;
      }>();
      const data: SystemDeptApi.DeptSaveReq = {
        email: values.email,
        leader: values.leader,
        name: values.name,
        phone: values.phone,
        pid: values.pid,
        remark: values.remark,
        sort: values.sort,
        status: values.status,
      };
      try {
        await (formData.value?.id
          ? updateDept(formData.value.id, data)
          : createDept(data));
        drawerApi.close();
        emit('success');
      } finally {
        drawerApi.lock(false);
      }
    }
  },
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData();
      formData.value = data ?? undefined;
      formApi.reset();
      await nextTick();
      if (data) {
        // 不直接改写共享数据，顶级部门的 pid 仅在表单取值上置空
        formApi.setValues({
          ...data,
          ...(data.pid === '0' ? { pid: undefined } : {}),
        });
      }
    }
  },
});

defineExpose({ drawerApi });
</script>

<template>
  <Drawer :title="getTitle">
    <Form class="mx-4" />
    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>
