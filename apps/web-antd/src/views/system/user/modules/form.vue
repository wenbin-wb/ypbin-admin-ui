<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createUser, updateUser } from '#/api/system/user';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);
const formData = ref<SystemUserApi.SystemUser>();
const id = ref();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Drawer, drawerApi] = useVbenDrawer<null | SystemUserApi.SystemUser>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues<{
      deptId?: string;
      email?: string;
      gender?: 0 | 1 | 2;
      nickname?: string;
      password?: string;
      phone?: string;
      postIds?: string[];
      realName: string;
      remark?: string;
      status: 0 | 1;
      username: string;
    }>();
    const data: SystemUserApi.UserSaveReq = {
      deptId: values.deptId,
      email: values.email,
      gender: values.gender,
      nickname: values.nickname,
      password: values.password,
      phone: values.phone,
      postIds: values.postIds,
      realName: values.realName,
      remark: values.remark,
      status: values.status,
      username: values.username,
    };
    drawerApi.lock();
    (id.value ? updateUser(id.value, data) : createUser(data))
      .then(() => {
        emits('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData();
      formApi.reset();

      if (data) {
        formData.value = data;
        id.value = data.id;
      } else {
        formData.value = undefined;
        id.value = undefined;
      }

      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
    }
  },
});

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.user.name')])
    : $t('ui.actionTitle.create', [$t('system.user.name')]);
});

defineExpose({ drawerApi });
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
</template>
