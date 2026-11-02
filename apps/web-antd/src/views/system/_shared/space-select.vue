<script lang="ts" setup>
/**
 * 空间选择器（通用组件）。
 *
 * **为什么做成独立组件**：空间是基础模块的通用维度，凡是「某个业务对象在哪个位置」的场景
 * 都要用它——部门/人员/设备/资产/未来的工单。若各页面自己写一个树选择器，会出现
 * 三份口径不一致的实现（是否允许选非叶子、是否显示全路径、清空后传 null 还是 ''），
 * 而空间的「选错层级」是不可从页面看出来的错误（选了「A 栋」而不是「A 栋 1F 101 室」）。
 *
 * 组件只负责**选**，不负责提交；绑定动作由调用方按业务语义决定
 * （例如设备用 `clearOthers: true` 表示挪位置，部门用 `false` 表示可多空间点）。
 *
 * @example 单选（设备：精确到房间，不允许选到楼栋/楼层）
 * ```vue
 * <SpaceSelect v-model="form.spaceId" leaf-only />
 * ```
 *
 * @example 多选（部门：可对应多个空间点）
 * ```vue
 * <SpaceSelect v-model="spaceIds" multiple />
 * ```
 *
 * @example 编辑场景：排除自身及子树（防把空间挂到自己下面）
 * ```vue
 * <SpaceSelect v-model="form.pid" :exclude-ids="collectSubtreeIds(tree, form.id)" />
 * ```
 */
import type { SpaceTreeNode } from './space-tree';

import { computed, onMounted, ref, watch } from 'vue';

import { TreeSelect } from 'ant-design-vue';

import { getSpaceTree } from '#/api/system/space';
import { $t } from '#/locales';

import { toSpaceTree } from './space-tree';

interface Props {
  /** 已选空间 ID（单选为 string，多选为 string[]） */
  modelValue?: null | string | string[];
  /** 是否多选 */
  multiple?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否允许清空 */
  allowClear?: boolean;
  /** 占位提示 */
  placeholder?: string;
  /**
   * 是否只允许选「叶子空间」（默认 `false`）。
   *
   * 设备/人员通常要精确到房间 ⇒ 置 `true`；部门可以是整栋楼 ⇒ 保持 `false`。
   * 这个开关是本组件存在的核心理由之一：选到楼栋还是房间，页面上看不出对错。
   */
  leafOnly?: boolean;
  /** 是否排除某些空间（如编辑时排除自身及其子树，避免把空间挂到自己下面） */
  excludeIds?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  allowClear: true,
  disabled: false,
  excludeIds: () => [],
  leafOnly: false,
  modelValue: undefined,
  multiple: false,
  placeholder: '',
});

const emit = defineEmits<{
  change: [value: null | string | string[], option: unknown];
  'update:modelValue': [value: null | string | string[]];
}>();

const treeData = ref<SpaceTreeNode[]>([]);
const loading = ref(false);
const loadError = ref('');

const normalizedValue = computed<null | string | string[] | undefined>(() => {
  if (props.multiple) {
    if (Array.isArray(props.modelValue)) {
      return props.modelValue;
    }
    return props.modelValue ? [props.modelValue] : [];
  }
  return props.modelValue ?? undefined;
});

async function loadTree() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await getSpaceTree();
    // 转换规则（leafOnly/excludeIds 语义）收在纯函数里，由 space-tree.test.ts 钉住
    treeData.value = toSpaceTree(data, {
      excludeIds: props.excludeIds,
      leafOnly: props.leafOnly,
    });
  } catch (error) {
    // 不静默：加载失败必须让用户看见（否则下拉是空的，用户以为「没有空间可用」）。
    // **不再向上 throw**：本方法的调用点是 onMounted 与 watch 回调，都没有 catch，
    // rethrow 只会产生 unhandled rejection（控制台报错、界面已有红色提示），
    // 属「已告知用户却又制造噪声」。
    loadError.value = $t('system.space.loadFailed');
    // 保留原始错误到控制台便于排障（不是业务提示，不展示给用户）
    console.error('加载空间树失败', error);
  } finally {
    loading.value = false;
  }
}

function onUpdate(value: null | string | string[] | undefined) {
  const normalized = props.multiple ? (value ?? []) : (value ?? null);
  emit('update:modelValue', normalized);
  emit('change', normalized, value);
}

// 用 join 后的字符串做比较：父组件传内联数组（`:exclude-ids="[id]"`）时每次渲染都是新引用，
// 直接 watch 数组会触发无意义的全量重拉。
watch(
  () => props.excludeIds.join(','),
  () => {
    void loadTree();
  },
);

onMounted(() => {
  void loadTree();
});

defineExpose({ reload: loadTree });
</script>

<template>
  <div class="w-full">
    <TreeSelect
      :allow-clear="allowClear"
      :disabled="disabled"
      :loading="loading"
      :multiple="multiple"
      :placeholder="placeholder || $t('system.space.selectPlaceholder')"
      :tree-data="treeData"
      :tree-default-expand-all="false"
      :value="normalizedValue"
      class="w-full"
      show-search
      tree-node-filter-prop="label"
      @update:value="onUpdate"
    />
    <!-- 加载失败必须显式提示：空下拉会让用户以为「系统里没有空间」 -->
    <div v-if="loadError" class="mt-1 text-xs text-destructive-text">
      {{ loadError }}
    </div>
  </div>
</template>
