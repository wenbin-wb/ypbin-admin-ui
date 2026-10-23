<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';

import { computed, ref } from 'vue';

import { useVbenDrawer, VbenDescriptions } from '@vben/common-ui';

import { $t } from '#/locales';

import SpaceRelationPanel from '../../_shared/space-relation-panel.vue';
import { useDescriptionItems } from '../data';

const detailData = ref<SystemUserApi.SystemUser>();

const items = computed(() => useDescriptionItems(detailData.value));

const [Drawer, drawerApi] = useVbenDrawer<SystemUserApi.SystemUser>({
  onOpenChange(isOpen) {
    if (isOpen) {
      detailData.value = drawerApi.getData();
    }
  },
});

defineExpose({ drawerApi });
</script>
<template>
  <Drawer :footer="false" :title="$t('common.detail')">
    <VbenDescriptions bordered :column="1" :items="items" />

    <!-- 所在空间：人员可同时在多个空间点（如兼职在两个办公区），故用可增删的关联面板 -->
    <div v-if="detailData?.id" class="mt-4">
      <div class="mb-2 text-sm font-medium">
        {{ $t('system.space.userSpace') }}
      </div>
      <SpaceRelationPanel :target-id="detailData.id" target-type="user" />
    </div>
  </Drawer>
</template>
