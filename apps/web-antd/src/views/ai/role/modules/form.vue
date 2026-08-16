<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createRole, updateRole } from '#/api/ai';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits<{ reload: [] }>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<AiApi.ChatRole | null>({
  onConfirm: async () => {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues<AiApi.ChatRoleSaveReq>();
    const data = drawerApi.getData();
    drawerApi.lock();
    (data?.id ? updateRole(data.id, values) : createRole(values))
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
    formApi.reset();
    const data = drawerApi.getData();
    if (data) {
      await formApi.setValues({
        category: data.category,
        description: data.description ?? '',
        modelPreference: data.modelPreference ?? '',
        name: data.name,
        systemPrompt: '',
        temperature: data.temperature,
      });
    }
  },
});

const getDrawerTitle = computed(() => {
  return drawerApi.getData()?.id
    ? $t('page.ai.role.edit')
    : $t('page.ai.role.create');
});

defineExpose({ drawerApi });
</script>

<template>
  <Drawer :title="getDrawerTitle" :width="560">
    <Form />
  </Drawer>
</template>
