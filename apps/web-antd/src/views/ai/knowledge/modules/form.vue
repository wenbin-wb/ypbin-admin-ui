<script lang="ts" setup>
import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createKnowledgeBase } from '#/api/ai';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits<{ reload: [] }>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer({
  onConfirm: async () => {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues<{
      description?: string;
      name: string;
      remark?: string;
    }>();
    drawerApi.lock();
    createKnowledgeBase(values)
      .then(() => {
        drawerApi.close();
        emits('reload');
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },
  onOpenChange: (isOpen) => {
    if (isOpen) {
      formApi.resetForm();
    }
  },
});

defineExpose({ drawerApi });
</script>

<template>
  <Drawer :title="$t('page.ai.knowledge.create')" :width="480">
    <Form />
  </Drawer>
</template>