<script lang="ts" setup>
import type { AiApi } from '#/api/ai';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createKnowledgeBase, updateKnowledgeBase } from '#/api/ai';
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
    const values = await formApi.getValues<AiApi.KnowledgeBaseSaveReq>();
    drawerApi.lock();
    const existing = drawerApi.getData() as AiApi.KnowledgeBase | null;
    const req = existing
      ? updateKnowledgeBase(existing.id, values as AiApi.KnowledgeBaseUpdateReq)
      : createKnowledgeBase(values);
    req
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
      const kb = drawerApi.getData() as AiApi.KnowledgeBase | null;
      if (kb) {
        formApi.setValues({
          name: kb.name,
          description: kb.description ?? '',
          icon: kb.icon ?? '',
          remark: '',
        });
      } else {
        formApi.reset();
      }
    }
  },
});

defineExpose({ drawerApi });
</script>

<template>
  <Drawer
    :title="
      (drawerApi.getData() as AiApi.KnowledgeBase | null)
        ? `${$t('common.edit')} · ${(drawerApi.getData() as AiApi.KnowledgeBase).name}`
        : $t('page.ai.knowledge.create')
    "
    :width="480"
  >
    <Form />
  </Drawer>
</template>
