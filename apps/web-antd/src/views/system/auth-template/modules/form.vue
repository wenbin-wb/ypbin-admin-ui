<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import { nextTick, ref } from 'vue';

import { Tree, useVbenDrawer } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { message, Spin } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createAuthTemplate,
  updateAuthTemplate,
} from '#/api/system/auth-template';
import { getMenuList } from '#/api/system/menu';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['reload']);

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const permissions = ref<any[]>([]);
const loadingPermissions = ref(false);

async function loadPermissions() {
  if (permissions.value.length > 0) {
    return;
  }
  loadingPermissions.value = true;
  try {
    const res = await getMenuList();
    permissions.value = res as unknown as any[];
  } finally {
    loadingPermissions.value = false;
  }
}

function getNodeClass(node: Recordable<any>) {
  const classes: string[] = [];
  if (node.value?.type === 'button') {
    classes.push('inline-flex');
  }
  return classes.join(' ');
}

const [Drawer, drawerApi] = useVbenDrawer({
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
      const values = await formApi.getValues();
      const data = drawerApi.getData<Record<string, any>>();
      await (data?.isUpdate
        ? updateAuthTemplate(data.id, values)
        : createAuthTemplate(values));
      message.success($t('common.success'));
      drawerApi.close();
      emit('reload');
    } finally {
      drawerApi.setState({ confirmLoading: false });
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData<Record<string, any>>();
      formApi.reset();
      drawerApi.setState({
        title: data?.isUpdate
          ? $t('ui.actionTitle.edit', [$t('system.authTemplate.title')])
          : $t('ui.actionTitle.create', [$t('system.authTemplate.title')]),
      });
      await loadPermissions();
      await nextTick();
      if (data?.isUpdate && data?.row) {
        formApi.setValues(data.row);
      }
    }
  },
});
</script>
<template>
  <Drawer class="w-[700px]">
    <Form>
      <template #menuIds="slotProps">
        <Spin :spinning="loadingPermissions" :classes="{ root: 'w-full' }">
          <Tree
            :tree-data="permissions"
            multiple
            bordered
            :default-expanded-level="2"
            :get-node-class="getNodeClass"
            v-bind="slotProps.componentProps"
            value-field="id"
            label-field="meta.title"
            icon-field="meta.icon"
          >
            <template #node="{ value }">
              <IconifyIcon v-if="value.meta?.icon" :icon="value.meta.icon" />
              {{ $t(value.meta?.title) }}
            </template>
          </Tree>
        </Spin>
      </template>
    </Form>
  </Drawer>
</template>
