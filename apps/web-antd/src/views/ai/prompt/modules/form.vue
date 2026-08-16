<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createPromptTemplate, updatePromptTemplate } from '#/api/ai';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits<{ reload: [] }>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<AiApi.PromptTemplate | null>({
  onConfirm: async () => {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues<AiApi.PromptTemplateSaveReq>();
    const data = drawerApi.getData();
    drawerApi.lock();
    (data?.id ? updatePromptTemplate(data.id, values) : createPromptTemplate(values))
      .then(() => {
        drawerApi.close();
        emits('reload');
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },
  onOpenChange: async (isOpen) => {
    if (!isOpen) return;
    formApi.resetForm();
    const data = drawerApi.getData();
    if (data) {
      await formApi.setValues({
        category: data.category,
        description: data.description,
        name: data.name,
        template: data.template,
      });
    }
  },
});

const getDrawerTitle = computed(() => {
  return drawerApi.getData()?.id
    ? $t('page.ai.prompt.edit')
    : $t('page.ai.prompt.create');
});

defineExpose({ drawerApi });
</script>

<template>
  <Drawer :title="getDrawerTitle" :width="560">
    <Form />
  </Drawer>
</template>
