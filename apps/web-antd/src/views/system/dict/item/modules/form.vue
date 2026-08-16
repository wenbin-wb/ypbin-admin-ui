<script lang="ts" setup>
import type { SystemDictItemApi } from '#/api/system/dictItem';

import { nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createDictItem, updateDictItem } from '#/api/system/dictItem';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['reload']);
const isUpdate = ref(false);
const rowId = ref('');
const parentDictId = ref('');

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

type DictItemFormData = {
  dictId: string;
} & (
  | { isUpdate: false }
  | { isUpdate: true; row: SystemDictItemApi.DictItemResp }
);

const [Drawer, drawerApi] = useVbenDrawer<DictItemFormData>({
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
      const values = await formApi.getValues<{
        color?: string;
        label: string;
        remark?: string;
        sort: number;
        status: 0 | 1;
        value: string;
      }>();

      const submitData: SystemDictItemApi.DictItemSaveReq = {
        color: values.color,
        dictId: parentDictId.value,
        label: values.label,
        remark: values.remark,
        sort: values.sort,
        status: values.status,
        value: values.value,
      };

      await (isUpdate.value
        ? updateDictItem(rowId.value, submitData)
        : createDictItem(submitData));

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
      isUpdate.value = !!data?.isUpdate;
      parentDictId.value = data?.dictId ?? '';
      rowId.value = data?.isUpdate ? data.row.id : '';
      formApi.reset();

      drawerApi.setState({
        title: isUpdate.value
          ? $t('ui.actionTitle.edit', [$t('system.dictItem.name')])
          : $t('ui.actionTitle.create', [$t('system.dictItem.name')]),
      });

      await nextTick();
      if (data?.isUpdate) {
        formApi.setValues(data.row);
      }
    }
  },
});

defineExpose({ drawerApi });
</script>

<template>
  <Drawer>
    <Form />
  </Drawer>
</template>
