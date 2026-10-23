<script lang="ts" setup>
/**
 * 空间关联管理抽屉：从空间侧看「这个空间上挂了哪些业务对象」，并支持绑定/解绑。
 *
 * 与 `_shared/space-relation-panel.vue`（对象侧视角）互补：
 * - 本抽屉：空间 → 对象（运维视角，一次把一批对象挂进机房/仓库）
 * - 那个面板：对象 → 空间（业务详情页视角，看这台设备在哪）
 *
 * 两侧共用同一后端契约（`/space/{id}/relations` 与 `/space/relations/by-target`）。
 */
import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import {
  Button,
  Empty,
  Input,
  message,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import { getDictOptions } from '#/api/system/dictItem';
import {
  bindSpaceRelations,
  getRelationsBySpace,
  unbindSpaceRelations,
} from '#/api/system/space';
import { $t } from '#/locales';

const emit = defineEmits(['success']);

interface DrawerData {
  spaceId: string;
  spacePath?: string;
}

const spaceId = ref<string>('');
const spacePath = ref<string>('');
/** 绑定表单：对象类型 */
const bindType = ref<string>('dept');
/** 绑定表单：对象 ID 文本（支持批量） */
const targetIdsInput = ref<string>('');
/** 已绑定列表的过滤类型（空=全部） */
const filterType = ref<string | undefined>(undefined);
const typeOptions = ref<{ label: string; value: string }[]>([]);
const submitting = ref(false);
const loading = ref(false);
const relations = ref<any[]>([]);
const loadError = ref('');

const canSubmit = computed(
  () => !!spaceId.value && !!bindType.value && parseIds().length > 0,
);

function parseIds(): string[] {
  return targetIdsInput.value
    .split(/[\s,，;；|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadTypes() {
  try {
    typeOptions.value = await getDictOptions('space_target_type');
  } catch (error) {
    // 字典不可用必须让用户看见；内置兜底保证抽屉仍可操作（显式降级，不静默）
    message.warning($t('system.space.typeDictFailed'));
    typeOptions.value = [
      { label: '部门', value: 'dept' },
      { label: '人员', value: 'user' },
      { label: '设备', value: 'device' },
      { label: '资产', value: 'asset' },
    ];
    console.error('加载空间对象类型字典失败', error);
  }
}

/**
 * 加载「本空间已挂了哪些对象」。
 *
 * 这是本抽屉的**主用途**（运维视角）。早期版本只在绑定成功后预览、且只查第一个输入的 ID，
 * 等于永远看不到现有绑定——用户没有任何入口知道这个空间上已有什么，也无法解绑。
 */
async function loadRelations() {
  if (!spaceId.value) {
    relations.value = [];
    return;
  }
  loading.value = true;
  loadError.value = '';
  try {
    relations.value = await getRelationsBySpace(spaceId.value, {
      targetType: filterType.value,
    });
  } catch (error: any) {
    loadError.value = error?.message ?? $t('system.space.relationLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function onBind() {
  const ids = parseIds();
  if (!spaceId.value || ids.length === 0) {
    return;
  }
  submitting.value = true;
  try {
    const count = await bindSpaceRelations(spaceId.value, {
      // 从空间侧批量绑定**不**清空其它关联：运维动作是「把这些对象也挂到这个空间」；
      // 「挪过来」是设备侧语义，应在对象详情页显式操作（那里有 clearOthers 开关）
      clearOthers: false,
      isPrimary: 0,
      targetIds: ids,
      targetType: bindType.value,
    });
    message.success($t('system.space.bindSuccess', [count]));
    targetIdsInput.value = '';
    emit('success');
    await loadRelations();
  } catch (error: any) {
    // 原样展示后端原因（类型非法/空间不存在/主空间冲突），不要笼统「绑定失败」
    message.error(error?.message ?? $t('system.space.bindFailed'));
  } finally {
    submitting.value = false;
  }
}

async function onUnbind(item: any) {
  try {
    await unbindSpaceRelations(spaceId.value, item.targetType, [item.targetId]);
    message.success($t('system.space.unbindSuccess'));
    emit('success');
    await loadRelations();
  } catch (error: any) {
    message.error(error?.message ?? $t('system.space.unbindFailed'));
  }
}

const [Drawer, drawerApi] = useVbenDrawer<DrawerData>({
  footer: false,
  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData();
      spaceId.value = data?.spaceId ?? '';
      spacePath.value = data?.spacePath ?? '';
      targetIdsInput.value = '';
      filterType.value = undefined;
      await loadTypes();
      await loadRelations();
    }
  },
});

defineExpose({ drawerApi });
</script>

<template>
  <Drawer :title="`${$t('system.space.manageRelation')} - ${spacePath}`">
    <div class="mx-4 flex flex-col gap-5">
      <!-- 绑定 -->
      <div class="rounded border border-solid p-3">
        <div class="mb-2 text-sm font-medium">
          {{ $t('system.space.bindNew') }}
        </div>
        <div class="mb-2">
          <div class="mb-1 text-sm">{{ $t('system.space.targetType') }}</div>
          <Select
            v-model:value="bindType"
            :options="typeOptions"
            class="w-full"
          />
        </div>
        <div class="mb-2">
          <div class="mb-1 text-sm">{{ $t('system.space.targetIds') }}</div>
          <Input.TextArea
            v-model:value="targetIdsInput"
            :placeholder="$t('system.space.targetIdsPlaceholder')"
            :rows="2"
          />
          <div class="mt-1 text-xs text-gray-500">
            {{ $t('system.space.targetIdsHelp') }}
          </div>
        </div>
        <Button
          :disabled="!canSubmit"
          :loading="submitting"
          block
          type="primary"
          @click="onBind"
        >
          {{ $t('system.space.bind') }}
        </Button>
      </div>

      <!-- 当前关联（可直接解绑） -->
      <div>
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium">
            {{ $t('system.space.currentRelation') }}
          </span>
          <Select
            v-model:value="filterType"
            :allow-clear="true"
            :options="typeOptions"
            :placeholder="$t('system.space.allTypes')"
            class="w-40"
            @change="loadRelations"
          />
        </div>

        <div v-if="loadError" class="mb-2 text-sm text-red-500">
          {{ loadError }}
        </div>

        <Spin :spinning="loading">
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
              <div class="flex min-w-0 items-center gap-2">
                <Tag color="blue">{{ item.targetType }}</Tag>
                <span class="truncate">ID: {{ item.targetId }}</span>
                <Tag v-if="item.isPrimary === 1" color="orange">
                  {{ $t('system.space.primary') }}
                </Tag>
              </div>
              <Button danger size="small" type="link" @click="onUnbind(item)">
                {{ $t('system.space.unbind') }}
              </Button>
            </div>
          </div>
        </Spin>
      </div>
    </div>
  </Drawer>
</template>
