<script lang="ts" setup>
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createDept, updateDept } from '#/api/system/dept';
import { getRelationsByTarget, syncTargetSpaces } from '#/api/system/space';
import { $t } from '#/locales';

import { useSchema } from '../data';

const emit = defineEmits(['success']);
type DeptFormData = null | Partial<SystemDeptApi.SystemDept>;

const formData = ref<Partial<SystemDeptApi.SystemDept>>();
/**
 * 打开时回显的空间集合（用于「只在变更时才调 sync」）。
 *
 * **为什么必须这样做**：sync 端点要求 `system:space:bind` 权限。存量租户角色没有该权限，
 * 若每次保存部门都无条件调 sync，就会出现「部门已保存成功 → sync 403 → 抽屉停在打开态」，
 * 用户以为没保存。只在用户真的改了空间集合时才调，未改则完全不触碰该权限。
 */
const originalSpaceIds = ref<string[]>([]);
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [$t('system.dept.name')])
    : $t('ui.actionTitle.create', [$t('system.dept.name')]);
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

const [Drawer, drawerApi] = useVbenDrawer<DeptFormData>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (valid) {
      drawerApi.lock();
      const values = await formApi.getValues<{
        email?: string;
        leader?: string;
        name: string;
        phone?: string;
        pid?: string;
        remark?: string;
        sort?: number;
        status: 0 | 1;
      }>();
      const data: SystemDeptApi.DeptSaveReq = {
        email: values.email,
        leader: values.leader,
        name: values.name,
        phone: values.phone,
        pid: values.pid,
        remark: values.remark,
        sort: values.sort,
        status: values.status,
      };
      try {
        // 先取空间选择（不在 DeptSaveReq 里，走独立绑定接口）
        const formValues = await formApi.getValues<{ spaceIds?: string[] }>();
        const spaceIds: string[] = formValues.spaceIds ?? [];
        const isCreate = !formData.value?.id;
        let deptId: string | undefined;
        if (isCreate) {
          // 新建接口现在返回新部门 ID ⇒ 新建时也能立即绑定空间（此前会静默丢弃用户的选择）
          deptId = (await createDept(data)) as unknown as string;
        } else {
          const existingId = formData.value?.id;
          if (existingId) {
            deptId = existingId;
            await updateDept(existingId, data);
          }
        }
        // 只在空间集合**发生变更**时调 sync：未变更时不触碰 `system:space:bind` 权限，
        // 否则没有该权限的存量角色连「改个备注」都会在保存后报 403（部门已存、关联失败）。
        const changed =
          isCreate ||
          spaceIds.length !== originalSpaceIds.value.length ||
          spaceIds.some((id) => !originalSpaceIds.value.includes(id));
        if (deptId && changed) {
          try {
            // 一次性同步（单事务算差集 + 批量增删），不是 N 次 bind/unbind
            await syncTargetSpaces({
              spaceIds,
              targetId: deptId,
              targetType: 'dept',
            });
          } catch (error: any) {
            // 部门已保存成功，但空间关联失败：必须明确告知「哪一步失败了」，
            // 不能笼统报「保存失败」（用户会以为部门没存，重复提交）
            message.error(
              `${$t('system.space.relationSyncFailed')}${error?.message ?? ''}`,
            );
            drawerApi.lock(false);
            return;
          }
        }
        drawerApi.close();
        emit('success');
      } catch (error: any) {
        // 此前只有 try/finally ⇒ API 失败会变成 unhandled rejection（控制台报错、界面无提示）。
        // 这里显式提示并保持抽屉打开，让用户能改后重试。
        message.error(error?.message ?? $t('ui.actionMessage.operationFailed'));
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
        // 不直接改写共享数据，顶级部门的 pid 仅在表单取值上置空
        formApi.setValues({
          ...data,
          ...(data.pid === '0' ? { pid: undefined } : {}),
        });
        // 回显已有空间关联（部门可对应多个空间点）
        if (data.id) {
          try {
            const relations = await getRelationsByTarget({
              targetId: data.id,
              targetType: 'dept',
            });
            const ids = (relations ?? []).map((item) => item.spaceId);
            originalSpaceIds.value = ids;
            formApi.setValues({ spaceIds: ids });
          } catch {
            // 回显失败不阻断编辑：用户仍可改其它字段，但空间选择为空会让「保存」清掉关联，
            // 故给出提示而不是静默。这里用 message 而非抛错，避免整个抽屉打不开。
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
  <Drawer :title="getTitle">
    <Form class="mx-4" />
    <template #prepend-footer>
      <div class="flex-auto">
        <Button type="primary" danger @click="resetForm">
          {{ $t('common.reset') }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>
