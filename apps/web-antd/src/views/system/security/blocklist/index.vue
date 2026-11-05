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
    <Tabs v-model:active-key="activeKey">
      <Tabs.TabPane key="rule" :tab="$t('system.blocklist.ruleTab')">
        <RuleList />
      </Tabs.TabPane>
      <Tabs.TabPane key="auto" :tab="$t('system.blocklist.autoBanTab')">
        <AutoBanList />
      </Tabs.TabPane>
    </Tabs>
  </Page>
</template>
