<script lang="ts" setup>
import type { SystemPostApi } from '#/api/system/post';

import { nextTick } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createPost, updatePost } from '#/api/system/post';
import { getRelationsByTarget, syncTargetSpaces } from '#/api/system/space';
import { $t } from '#/locales';

const emit = defineEmits(['success']);

const [Form, formApi] = useVbenForm({
  schema: [
    {
      component: 'Input',
      fieldName: 'name',
      label: $t('system.post.postName'),
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'code',
      label: $t('system.post.code'),
      rules: 'required',
    },
    {
      component: 'InputNumber',
      fieldName: 'sort',
      label: $t('system.post.sort'),
      defaultValue: 0,
    },
    {
      component: 'RadioGroup',
      fieldName: 'status',
      label: $t('system.post.status'),
      defaultValue: 1,
      componentProps: {
        options: [
          { label: $t('system.post.statusNormal'), value: 1 },
          { label: $t('system.post.statusDisabled'), value: 0 },
        ],
      },
    },
    {
      // 工作地点：岗位是「职能 + 办公地点」，一个岗位可对应多个办公点（如「运维工程师」
      // 同时在 A 栋机房与 B 栋机房），故用多选。
      // 绑定走独立接口（/space/relations/sync），不塞进 PostSaveReq——
      // 否则「改个岗位名称」也会要求空间绑定权限。
      component: 'ApiTreeSelect',
      componentProps: {
        allowClear: true,
        api: async () => {
          const { getSpaceTree } = await import('#/api/system/space');
          return (await getSpaceTree()) ?? [];
        },
        childrenField: 'children',
        class: 'w-full',
        labelField: 'name',
        multiple: true,
        valueField: 'id',
      },
      fieldName: 'spaceIds',
      label: $t('system.space.postSpace'),
    },
    { component: 'Textarea', fieldName: 'remark', label: $t('common.remark') },
  ],
  showDefaultActions: false,
  layout: 'horizontal',
});

let isUpdate = false;
let updateId = '';

/**
 * 打开时回显的空间集合（用于「只在变更时才调 sync」）。
 *
 * **为什么必须记录**：sync 端点要求 `system:space:bind` 权限。存量租户角色没有该权限，
 * 若每次保存都无条件调 sync，就会出现「岗位已保存成功 → sync 403 → 抽屉停在打开态」。
 */
let originalSpaceIds: string[] = [];

const [Drawer, drawerApi] = useVbenDrawer<null | SystemPostApi.PostResp>({
  onCancel() {
    drawerApi.close();
  },
  async onConfirm() {
    try {
      drawerApi.lock();
      const { valid } = await formApi.validate();
      if (!valid) {
        return;
      }
      const values = await formApi.getValues<{
        code: string;
        name: string;
        remark?: string;
        sort: number;
        spaceIds?: string[];
        status: 0 | 1;
      }>();
      const data: SystemPostApi.PostSaveReq = {
        code: values.code,
        name: values.name,
        remark: values.remark,
        sort: values.sort,
        status: values.status,
      };
      // 新建接口返回新 ID ⇒ 新建时也能立即绑定工作地点（此前会静默丢弃用户的选择）
      let postId: string | undefined;
      if (isUpdate) {
        postId = updateId;
        await updatePost(updateId, data);
      } else {
        postId = (await createPost(data)) as unknown as string;
      }
      // 只在空间集合**变更**时才调 sync：未变更时不触碰 `system:space:bind` 权限，
      // 否则没有该权限的存量角色连改岗位名称都会在保存后报 403（岗位已存、关联失败）
      const spaceIds = values.spaceIds ?? [];
      const changed =
        !isUpdate ||
        spaceIds.length !== originalSpaceIds.length ||
        spaceIds.some((id) => !originalSpaceIds.includes(id));
      if (postId && changed) {
        try {
          // 一次性同步（单事务算差集 + 批量增删），不是 N 次 bind/unbind
          await syncTargetSpaces({
            spaceIds,
            targetId: postId,
            targetType: 'post',
          });
        } catch (error: any) {
          // 岗位已保存成功，但空间关联失败：明确告知「哪一步失败了」，
          // 不能笼统报「保存失败」（用户会以为岗位没存，重复提交）
          message.error(
            `${$t('system.space.relationSyncFailed')}${error?.message ?? ''}`,
          );
          drawerApi.unlock();
          return;
        }
      }
      message.success($t('common.success'));
      emit('success');
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (isOpen) {
      const data = drawerApi.getData();
      isUpdate = !!data?.id;
      updateId = data?.id ?? '';
      formApi.reset();
      drawerApi.setState({
        title: isUpdate
          ? $t('system.post.editTitle')
          : $t('system.post.addTitle'),
      });
      originalSpaceIds = [];
      await nextTick();
      if (data) {
        formApi.setValues(data);
        // 回显已有工作地点（岗位可对应多个空间点）
        if (data.id) {
          try {
            const relations = await getRelationsByTarget({
              targetId: data.id,
              targetType: 'post',
            });
            const ids = (relations ?? []).map((item) => item.spaceId);
            originalSpaceIds = ids;
            formApi.setValues({ spaceIds: ids });
          } catch {
            // 回显失败不阻断编辑，但必须提示：否则用户保存时会把关联清空却不知道
            message.warning($t('system.space.relationLoadFailed'));
          }
        }
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
