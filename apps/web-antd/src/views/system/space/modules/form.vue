<script lang="ts" setup>
import type { SystemSpaceApi } from '#/api/system/space';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createSpace, updateSpace } from '#/api/system/space';
import { $t } from '#/locales';

import { useSchema } from '../data';

const emit = defineEmits(['success']);
type SpaceFormData = null | Partial<SystemSpaceApi.SpaceResp>;

const formData = ref<Partial<SystemSpaceApi.SpaceResp>>();
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.space.name')])
    : $t('ui.actionTitle.create', [$t('system.space.name')]);
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

const [Drawer, drawerApi] = useVbenDrawer<SpaceFormData>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (valid) {
      drawerApi.lock();
      const values = await formApi.getValues<Record<string, any>>();
      // **必须显式列出每个字段**（不能用展开）：后端 SpaceSaveReq 不接收 level，
      // 且 extJson 需要原样字符串透传。字段全程同名，不做改名映射。
      const data: SystemSpaceApi.SpaceSaveReq = {
        address: values.address ?? null,
        area: values.area ?? null,
        capacity: values.capacity ?? null,
        code: values.code ?? null,
        extJson: values.extJson ?? null,
        floorNo: values.floorNo ?? null,
        latitude: values.latitude ?? null,
        longitude: values.longitude ?? null,
        manager: values.manager ?? null,
        name: values.name,
        phone: values.phone ?? null,
        pid: values.pid ?? null,
        remark: values.remark ?? null,
        roomNo: values.roomNo ?? null,
        sort: values.sort ?? 0,
        spaceType: values.spaceType,
        status: values.status,
      };
      try {
        await (formData.value?.id
          ? updateSpace(formData.value.id, data)
          : createSpace(data));
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
        // 顶级空间的 pid 是 '0'，表单上应显示为空（「无父空间」），否则会尝试挂到 id=0 的节点
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
        <Button danger type="primary" @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>
