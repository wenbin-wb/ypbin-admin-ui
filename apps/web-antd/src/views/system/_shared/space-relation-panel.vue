<script lang="ts" setup>
/**
 * 空间关联面板（通用组件）：展示某个业务对象当前挂在哪些空间上，并支持增删。
 *
 * **为什么做成通用组件**：所有业务对象与空间的交互都是同一套——
 * 「看当前关联 → 加一个空间 → 去掉一个空间」，差别只在 `targetType`。
 * 各页面各写一遍会产生 N 份加载/提交/失败提示逻辑，而这里的失败处理有讲究：
 * 绑定失败必须把后端的具体原因（空间不存在/类型非法/主空间冲突）原样展示，
 * 不能笼统说「操作失败」——用户无法据此修正。
 *
 * @example 设备详情抽屉
 * ```vue
 * <SpaceRelationPanel :target-id="device.id" target-type="device" />
 * ```
 */
import type { SystemSpaceApi } from '#/api/system/space';

import { computed, onMounted, ref, watch } from 'vue';

import {
  Button,
  Empty,
  message,
  Modal,
  Spin,
  Switch,
  Tag,
} from 'ant-design-vue';

import {
  bindSpaceRelations,
  getRelationsByTarget,
  unbindSpaceRelations,
} from '#/api/system/space';
import { $t } from '#/locales';

import SpaceSelect from './space-select.vue';

interface Props {
  /** 业务对象 ID */
  targetId?: null | string;
  /** 业务对象类型（字典 space_target_type：dept/user/device/asset…） */
  targetType: string;
  /** 是否只读（只展示，不给增删） */
  readonly?: boolean;
  /**
   * 绑定新空间时是否默认「清空其它空间关联」。
   * 设备挪位置应为 true（一台设备只在一个位置）；部门/人员为 false（可多点办公）。
   */
  defaultClearOthers?: boolean;
  /**
   * 新增时是否默认设为主空间。
   * 设备/人员通常 true（只有一个位置）；部门通常 false。
   */
  defaultPrimary?: boolean;
  /**
   * 是否只允许选叶子空间（设备通常要精确到房间 ⇒ 传 true）。
   *
   * 必须在这里透传给 SpaceSelect：否则「设备只能挂到房间」这个业务约束
   * 在面板上根本表达不出来，调用方只能去改组件。
   */
  leafOnly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  defaultClearOthers: false,
  defaultPrimary: false,
  leafOnly: false,
  readonly: false,
  targetId: null,
});

const relations = ref<SystemSpaceApi.SpaceRelationResp[]>([]);
const loading = ref(false);
const submitting = ref(false);
const loadError = ref('');
const addOpen = ref(false);
const pendingSpaceId = ref<null | string>(null);
const pendingPrimary = ref(props.defaultPrimary);
const pendingClearOthers = ref(props.defaultClearOthers);

const canSubmit = computed(() => !!pendingSpaceId.value && !submitting.value);

async function load() {
  if (!props.targetId) {
    relations.value = [];
    return;
  }
  loading.value = true;
  loadError.value = '';
  try {
    relations.value = await getRelationsByTarget({
      targetId: props.targetId,
      targetType: props.targetType,
    });
  } catch (error: any) {
    // 原样暴露后端原因（服务不可用 / 类型非法），不静默成空列表
    loadError.value = error?.message ?? $t('system.space.relationLoadFailed');
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  pendingSpaceId.value = null;
  pendingPrimary.value = props.defaultPrimary;
  pendingClearOthers.value = props.defaultClearOthers;
  addOpen.value = true;
}

async function submitAdd() {
  if (!pendingSpaceId.value || !props.targetId) {
    return;
  }
  submitting.value = true;
  try {
    await bindSpaceRelations(pendingSpaceId.value, {
      clearOthers: pendingClearOthers.value,
      isPrimary: pendingPrimary.value ? 1 : 0,
      targetIds: [props.targetId],
      targetType: props.targetType,
    });
    message.success($t('system.space.relationSaved'));
    addOpen.value = false;
    await load();
  } catch (error: any) {
    // 后端会给具体原因（如「空间类型不合法」「父空间不存在」），原样展示
    message.error(error?.message ?? $t('system.space.relationSaveFailed'));
  } finally {
    submitting.value = false;
  }
}

function confirmRemove(relation: SystemSpaceApi.SpaceRelationResp) {
  Modal.confirm({
    content: $t('system.space.confirmRemoveContent', [
      relation.spacePath || relation.spaceName,
    ]),
    onOk: async () => {
      try {
        await unbindSpaceRelations(relation.spaceId, props.targetType, [
          relation.targetId,
        ]);
        message.success($t('system.space.relationRemoved'));
        await load();
      } catch (error: any) {
        message.error(
          error?.message ?? $t('system.space.relationRemoveFailed'),
        );
      }
    },
    title: $t('system.space.confirmRemoveTitle'),
  });
}

watch(() => [props.targetId, props.targetType], load);
onMounted(load);

defineExpose({ reload: load });
</script>

<template>
  <div class="w-full">
    <Spin :spinning="loading">
      <div v-if="loadError" class="mb-2 text-sm text-red-500">
        {{ loadError }}
      </div>

      <Empty
        v-if="relations.length === 0 && !loading"
        :description="$t('system.space.noRelation')"
      />
      <div v-else class="flex flex-col gap-2">
        <div
          v-for="item in relations"
          :key="item.id"
          class="flex items-center justify-between rounded border border-solid px-3 py-2"
        >
          <div class="flex min-w-0 flex-col">
            <div class="flex items-center gap-2">
              <span class="truncate font-medium">
                {{ item.spacePath || item.spaceName }}
              </span>
              <Tag v-if="item.isPrimary === 1" color="blue">
                {{ $t('system.space.primary') }}
              </Tag>
              <Tag v-if="item.spaceTypeText" color="default">
                {{ item.spaceTypeText }}
              </Tag>
            </div>
            <span v-if="item.remark" class="text-xs text-gray-500">
              {{ item.remark }}
            </span>
          </div>
          <Button
            v-if="!readonly"
            danger
            size="small"
            type="link"
            @click="confirmRemove(item)"
          >
            {{ $t('common.delete') }}
          </Button>
        </div>
      </div>

      <Button
        v-if="!readonly"
        :disabled="!targetId"
        class="mt-3"
        type="dashed"
        block
        @click="openAdd"
      >
        {{ $t('system.space.addRelation') }}
      </Button>
    </Spin>

    <Modal
      v-model:open="addOpen"
      :confirm-loading="submitting"
      :ok-button-props="{ disabled: !canSubmit }"
      :title="$t('system.space.addRelation')"
      @ok="submitAdd"
    >
      <div class="flex flex-col gap-4 py-2">
        <div>
          <div class="mb-1 text-sm">{{ $t('system.space.selectSpace') }}</div>
          <SpaceSelect v-model="pendingSpaceId" :leaf-only="leafOnly" />
        </div>
        <div class="flex items-center gap-2">
          <Switch v-model:checked="pendingPrimary" />
          <span class="text-sm">{{ $t('system.space.setPrimary') }}</span>
          <span class="text-xs text-gray-500">
            {{ $t('system.space.setPrimaryHint') }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <Switch v-model:checked="pendingClearOthers" />
          <span class="text-sm">{{ $t('system.space.clearOthers') }}</span>
          <span class="text-xs text-gray-500">
            {{ $t('system.space.clearOthersHint') }}
          </span>
        </div>
      </div>
    </Modal>
  </div>
</template>
