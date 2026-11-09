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
  <Page auto-content-height content-class="flex flex-col">
    <Tabs v-model:active-key="activeKey" class="mb-2 shrink-0">
      <Tabs.TabPane key="rule" :tab="$t('system.blocklist.ruleTab')" />
      <Tabs.TabPane key="auto" :tab="$t('system.blocklist.autoBanTab')" />
    </Tabs>
    <div class="min-h-0 flex-1">
      <RuleList v-if="activeKey === 'rule'" />
      <AutoBanList v-else />
    </div>
  </Page>
</template>
