<script lang="ts" setup>
import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Tabs } from 'ant-design-vue';

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
    <Tabs
      v-model:active-key="activeKey"
      tab-position="left"
      class="config-tabs"
    >
      <Tabs.TabPane
        v-for="group in builtInGroups"
        :key="group.key"
        :tab="group.tab"
      >
        <SocialConfigCards v-if="group.key === 'social'" />
        <GroupConfigForm v-else :config-group="group.key" />
      </Tabs.TabPane>
      <Tabs.TabPane key="custom" :tab="$t('system.config.tab.custom')">
        <CustomConfigList />
      </Tabs.TabPane>
    </Tabs>
  </Page>
</template>
<style scoped>
.config-tabs :deep(.ant-tabs-content-holder) {
  overflow: auto;
}
</style>
