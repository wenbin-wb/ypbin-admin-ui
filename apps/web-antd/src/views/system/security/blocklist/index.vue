<script lang="ts" setup>
import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Tabs } from 'ant-design-vue';

import { $t } from '#/locales';

import AutoBanList from './AutoBanList.vue';
import RuleList from './RuleList.vue';

const activeKey = ref('rule');
</script>
<template>
  <Page auto-content-height>
    <Tabs v-model:active-key="activeKey" class="security-tabs">
      <Tabs.TabPane key="rule" :tab="$t('system.blocklist.ruleTab')">
        <RuleList />
      </Tabs.TabPane>
      <Tabs.TabPane key="auto" :tab="$t('system.blocklist.autoBanTab')">
        <AutoBanList />
      </Tabs.TabPane>
    </Tabs>
  </Page>
</template>
<style scoped>
/* 让 Tab 内容撑满 Page，表格 height:auto 才能填满、分页固定在底部 */
.security-tabs {
  height: 100%;
}

.security-tabs :deep(.ant-tabs-content-holder) {
  min-height: 0;
}

.security-tabs :deep(.ant-tabs-content),
.security-tabs :deep(.ant-tabs-tabpane) {
  height: 100%;
}
</style>
