<script lang="ts" setup>
import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, Tabs } from 'ant-design-vue';

import { $t } from '#/locales';

import CustomConfigList from './CustomConfigList.vue';
import GroupConfigForm from './GroupConfigForm.vue';
import SocialConfigCards from './SocialConfigCards.vue';

const activeKey = ref('site');

const builtInGroups = [
  { key: 'site', tab: $t('system.config.tab.site') },
  { key: 'login', tab: $t('system.config.tab.login') },
  { key: 'password', tab: $t('system.config.tab.password') },
  { key: 'mail', tab: $t('system.config.tab.mail') },
  { key: 'sms', tab: $t('system.config.tab.sms') },
  { key: 'social', tab: $t('system.config.tab.social') },
];
</script>
<template>
  <Page auto-content-height>
    <div class="flex size-full">
      <!-- 左侧分组导航：卡片兜底（与用户管理页部门树风格一致） -->
      <Card class="config-nav h-full w-48 shrink-0" :bordered="false">
        <Tabs
          v-model:active-key="activeKey"
          tab-position="left"
          class="config-tabs"
        >
          <Tabs.TabPane
            v-for="group in builtInGroups"
            :key="group.key"
            :tab="group.tab"
          />
          <Tabs.TabPane key="custom" :tab="$t('system.config.tab.custom')" />
        </Tabs>
      </Card>

      <!-- 右侧内容区 -->
      <div class="config-content ml-4 min-w-0 flex-1">
        <SocialConfigCards v-if="activeKey === 'social'" />
        <GroupConfigForm
          v-else-if="activeKey !== 'custom'"
          :config-group="activeKey"
        />
        <CustomConfigList v-else />
      </div>
    </div>
  </Page>
</template>
<style scoped>
/* 左侧导航卡片：Tabs 仅作导航，隐藏空内容区（去掉中间竖条） */
.config-nav :deep(.ant-tabs) {
  display: flex;
  height: 100%;
}

.config-nav :deep(.ant-tabs-nav) {
  flex: 1;
  padding-top: 8px;
  margin-bottom: 0;
}

.config-nav :deep(.ant-tabs-nav-wrap) {
  display: flex;
  justify-content: center;
}

.config-nav :deep(.ant-tabs-content-holder) {
  display: none;
}

.config-nav :deep(.ant-tabs-tab) {
  justify-content: center;
  padding: 10px 16px !important;
  margin: 4px 0 !important;
  border-radius: 8px;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.config-nav :deep(.ant-tabs-tab:hover) {
  background: hsl(var(--foreground) / 5%);
}

.config-nav :deep(.ant-tabs-tab-active) {
  font-weight: 500;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.config-nav :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: hsl(var(--primary));
}

.config-nav :deep(.ant-tabs-ink-bar) {
  display: none;
}

/* 右侧内容区：flex 撑满剩余高度 */
.config-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
</style>
