<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type { SystemAuthTemplateApi } from '#/api/system/auth-template';

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

interface AuthTemplateFormValues {
  code: string;
  menuIds?: string[];
  name: string;
  remark?: string;
}

type AuthTemplateFormData = null | SystemAuthTemplateApi.AuthTemplateResp;

const [Drawer, drawerApi] = useVbenDrawer<AuthTemplateFormData>({
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
      const values = await formApi.getValues<AuthTemplateFormValues>();
      const request: SystemAuthTemplateApi.AuthTemplateSaveReq = {
        code: values.code,
        menuIds: values.menuIds,
        name: values.name,
        remark: values.remark,
      };
      const data = drawerApi.getData();
      await (data?.id
        ? updateAuthTemplate(data.id, request)
        : createAuthTemplate(request));
      message.success($t('common.success'));
      drawerApi.close();
      emit('reload');
    } finally {
      drawerApi.setState({ confirmLoading: false });
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData();
      formApi.reset();
      drawerApi.setState({
        title: data?.id
          ? $t('ui.actionTitle.edit', [$t('system.authTemplate.title')])
          : $t('ui.actionTitle.create', [$t('system.authTemplate.title')]),
      });
      await loadPermissions();
      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
    }
  },
});

defineExpose({ drawerApi });
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
            show-expand-all
            show-select-all
            :select-all-label="$t('ui.tree.selectAll')"
            :default-expanded-level="2"
            :get-node-class="getNodeClass"
            v-bind="slotProps.componentProps"
            value-field="id"
            label-field="title"
            icon-field="icon"
          >
            <template #node="{ value }">
              <IconifyIcon v-if="value.icon" :icon="value.icon" />
              {{ $t(value.title) }}
            </template>
          </Tree>
        </Spin>
      </template>
    </Form>
  </Drawer>
</template>
