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
      // 编辑时回填行/详情携带的 systemPrompt（后端 Resp 新增后生效）；
      // 此刻 Resp 尚无该字段时留空由「rules: required」兜底，禁止空提交覆盖旧提示词。
      const nextValues: AiApi.ChatRoleSaveReq = {
        category: data.category,
        description: data.description ?? '',
        modelPreference: data.modelPreference ?? '',
        name: data.name,
        systemPrompt: data.systemPrompt ?? '',
        temperature: data.temperature,
      };
      await formApi.setValues(nextValues);
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
