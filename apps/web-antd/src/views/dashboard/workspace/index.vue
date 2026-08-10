<script lang="ts" setup>
import type {
  WorkbenchQuickNavItem,
  WorkbenchTrendItem,
} from '@vben/common-ui';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  WorkbenchHeader,
  WorkbenchQuickNav,
  WorkbenchTrends,
} from '@vben/common-ui';
import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import { Button, Empty, Result, Spin } from 'ant-design-vue';

import { getLatestLogs } from '#/api';
import { $t } from '#/locales';

const userStore = useUserStore();
const router = useRouter();

const quickNavItems: WorkbenchQuickNavItem[] = [
  {
    color: '#1fdaca',
    icon: 'carbon:user',
    title: $t('system.user.title'),
    url: '/system/user',
  },
  {
    color: '#bf0c2c',
    icon: 'carbon:user-role',
    title: $t('system.role.title'),
    url: '/system/role',
  },
  {
    color: '#e18525',
    icon: 'carbon:menu',
    title: $t('system.menu.title'),
    url: '/system/menu',
  },
  {
    color: '#3fb27f',
    icon: 'carbon:container-services',
    title: $t('system.dept.title'),
    url: '/system/dept',
  },
  {
    color: '#4daf1bc9',
    icon: 'carbon:document',
    title: $t('system.log.title'),
    url: '/system/log',
  },
  {
    color: '#00d8ff',
    icon: 'carbon:user-online',
    title: $t('system.onlineUser.title'),
    url: '/system/online-user',
  },
];

const trendError = ref(false);
const trendItems = ref<WorkbenchTrendItem[]>([]);
const trendLoading = ref(true);
const trendsLoaded = ref(false);

const avatars = [
  'svg:avatar-1',
  'svg:avatar-2',
  'svg:avatar-3',
  'svg:avatar-4',
];

async function loadTrends() {
  trendError.value = false;
  trendLoading.value = true;
  try {
    const logs = await getLatestLogs(9);
    trendItems.value = logs.map((log, index) => ({
      avatar: avatars[index % avatars.length] as string,
      content: `${log.module ? `[${log.module}] ` : ''}${log.description ?? ''}`,
      date: log.operateTime,
      title: log.operateUserIdName || log.operateUserId,
    }));
    trendsLoaded.value = true;
  } catch (error) {
    console.error('Failed to load dashboard latest logs:', error);
    trendError.value = true;
    trendsLoaded.value = false;
  } finally {
    trendLoading.value = false;
  }
}

onMounted(() => {
  void loadTrends();
});

const welcomeTitle = computed(
  () =>
    `${$t('page.dashboard.welcome')}, ${userStore.userInfo?.realName ?? ''}`,
);

function navTo(nav: WorkbenchQuickNavItem) {
  if (nav.url?.startsWith('http')) {
    openWindow(nav.url);
    return;
  }
  if (nav.url?.startsWith('/')) {
    router.push(nav.url).catch((error) => {
      console.error('Navigation failed:', error);
    });
  }
}
</script>

<template>
  <div class="p-5">
    <WorkbenchHeader
      :avatar="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
    >
      <template #title>{{ welcomeTitle }}</template>
    </WorkbenchHeader>

    <div class="mt-5 flex flex-col lg:flex-row">
      <div class="mr-4 w-full lg:w-3/5">
        <Spin :spinning="trendLoading">
          <WorkbenchTrends
            v-if="trendsLoaded && trendItems.length > 0"
            :items="trendItems"
            :title="$t('page.dashboard.latestActivity')"
          />
          <Result
            v-else-if="trendError"
            status="error"
            :title="$t('page.dashboard.loadFailed')"
          >
            <template #extra>
              <Button type="primary" @click="loadTrends">
                {{ $t('page.dashboard.retry') }}
              </Button>
            </template>
          </Result>
          <Empty
            v-else-if="trendsLoaded"
            :description="$t('page.dashboard.noData')"
          />
        </Spin>
      </div>
      <div class="w-full lg:w-2/5">
        <WorkbenchQuickNav
          :items="quickNavItems"
          class="lg:mt-0"
          :title="$t('page.dashboard.quickNav')"
          @click="navTo"
        />
      </div>
    </div>
  </div>
</template>
