<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { computed } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createModel, updateModel } from '#/api/ai';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits<{ reload: [] }>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<AiApi.ModelConfig | null>({
  onConfirm: async () => {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues<AiApi.ModelConfigSaveReq>();
    const data = drawerApi.getData();
    drawerApi.lock();
    (data?.id ? updateModel(data.id, values) : createModel(values))
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
        baseUrl: data.baseUrl ?? '',
        modelName: data.modelName,
        name: data.name,
        provider: data.provider,
        remark: data.remark ?? '',
        // apiKey 不回填：列表只返回脱敏值，留空表示不修改
      });
    }
  },
});

const getDrawerTitle = computed(() => {
  return drawerApi.getData()?.id
    ? $t('page.ai.config.editModel')
    : $t('page.ai.config.addModel');
});

defineExpose({ drawerApi });
</script>

<template>
  <Drawer :title="getDrawerTitle" :width="520">
    <Form />
  </Drawer>
</template>
