<script lang="ts" setup>
import type {
  WorkbenchProjectItem,
  WorkbenchQuickNavItem,
  WorkbenchTodoItem,
} from '@vben/common-ui';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  WorkbenchHeader,
  WorkbenchProject,
  WorkbenchQuickNav,
  WorkbenchTodo,
  WorkbenchTrends,
} from '@vben/common-ui';
import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import { Button, Empty, Result, Spin } from 'ant-design-vue';

import { getDashboardStats } from '#/api';
import { $t } from '#/locales';

import { useWorkbenchTrends } from './use-workbench-trends';

const userStore = useUserStore();
const router = useRouter();

// 动态趋势域（操作日志流 + 演示数据兜底）
const {
  loadTrends,
  trendError,
  trendItems,
  trendLoading,
  trendsLoaded,
  usingDemoTrends,
} = useWorkbenchTrends();

void loadStats();

// ---- 统一视觉（与统计看板/分析页同语言）----
const BRAND_GRAD =
  'linear-gradient(135deg, hsl(var(--primary)), hsl(245 82% 67%))';

// ---- 今日概览指标（真实数据：GET /dashboard/stats）----
interface MetricCard {
  key: string;
  label: string;
  value: string;
  icon: string;
  grad: string;
  glow: string;
}

const stats = ref({
  userCount: 0,
  roleCount: 0,
  deptCount: 0,
  menuCount: 0,
  onlineCount: 0,
  logCount: 0,
});

const metricCards = computed<MetricCard[]>(() => [
  {
    key: 'user',
    label: $t('page.dashboard.user'),
    value: String(stats.value.userCount ?? 0),
    icon: 'i-lucide-users',
    grad: 'linear-gradient(135deg, hsl(var(--primary)), hsl(245 82% 67%))',
    glow: 'hsl(var(--primary) / 30%)',
  },
  {
    key: 'role',
    label: $t('page.dashboard.role'),
    value: String(stats.value.roleCount ?? 0),
    icon: 'i-lucide-user-cog',
    grad: 'linear-gradient(135deg, hsl(245 82% 67%), hsl(161 90% 43%))',
    glow: 'hsl(245 82% 67% / 30%)',
  },
  {
    key: 'dept',
    label: $t('page.dashboard.dept'),
    value: String(stats.value.deptCount ?? 0),
    icon: 'i-lucide-building-2',
    grad: 'linear-gradient(135deg, hsl(199 89% 48%), hsl(161 90% 43%))',
    glow: 'hsl(199 89% 48% / 30%)',
  },
  {
    key: 'online',
    label: $t('page.dashboard.online'),
    value: String(stats.value.onlineCount ?? 0),
    icon: 'i-lucide-wifi',
    grad: 'linear-gradient(135deg, hsl(32 95% 44%), hsl(16 90% 50%))',
    glow: 'hsl(32 95% 44% / 30%)',
  },
]);

async function loadStats() {
  try {
    const data = await getDashboardStats();
    stats.value = { ...stats.value, ...data };
  } catch (error) {
    console.error('Failed to load dashboard stats:', error);
  }
}

// ---- 快捷导航 ----
const quickNavItems: WorkbenchQuickNavItem[] = [
  {
    color: '#0066f5',
    icon: 'carbon:user',
    title: $t('system.user.title'),
    url: '/system/user',
  },
  {
    color: '#7c7cf0',
    icon: 'carbon:user-role',
    title: $t('system.role.title'),
    url: '/system/role',
  },
  {
    color: '#0ec9a3',
    icon: 'carbon:menu',
    title: $t('system.menu.title'),
    url: '/system/menu',
  },
  {
    color: '#f0b429',
    icon: 'carbon:container-services',
    title: $t('system.dept.title'),
    url: '/system/dept',
  },
  {
    color: '#f2547b',
    icon: 'carbon:document',
    title: $t('system.log.title'),
    url: '/system/log',
  },
  {
    color: '#5a6cf0',
    icon: 'carbon:user-online',
    title: $t('system.onlineUser.title'),
    url: '/system/online-user',
  },
];

// ---- 项目卡片（真实统计入口）----
const PROJECT_COLORS = [
  '#0066f5', // 蓝（primary）
  '#7c7cf0', // 靛紫
  '#0ec9a3', // 青绿
  '#f0b429', // 黄
  '#f2547b', // 红
  '#5a6cf0', // 蓝紫
];

const projectItems = computed<WorkbenchProjectItem[]>(() => [
  {
    title: $t('page.dashboard.projectKb'),
    icon: 'carbon:database-enterprise',
    color: PROJECT_COLORS[0],
    content: $t('page.dashboard.projectKbContent'),
    group: $t('page.dashboard.groupKnowledge'),
    date: $t('page.dashboard.justNow'),
    url: '/ai/knowledge',
  },
  {
    title: $t('page.dashboard.projectChat'),
    icon: 'carbon:chat-bot',
    color: PROJECT_COLORS[1],
    content: $t('page.dashboard.projectChatContent'),
    group: $t('page.dashboard.groupAiApp'),
    date: $t('page.dashboard.justNow'),
    url: '/ai/chat',
  },
  {
    title: $t('page.dashboard.projectModel'),
    icon: 'carbon:ai-status',
    color: PROJECT_COLORS[2],
    content: $t('page.dashboard.projectModelContent'),
    group: $t('page.dashboard.groupResource'),
    date: $t('page.dashboard.justNow'),
    url: '/ai/config',
  },
  {
    title: $t('page.dashboard.projectUsage'),
    icon: 'carbon:chart-line',
    color: PROJECT_COLORS[3],
    content: $t('page.dashboard.projectUsageContent'),
    group: $t('page.dashboard.groupAnalysis'),
    date: $t('page.dashboard.justNow'),
    url: '/ai/usage',
  },
  {
    title: $t('page.dashboard.projectWidget'),
    icon: 'carbon:web-services-container',
    color: PROJECT_COLORS[4],
    content: $t('page.dashboard.projectWidgetContent'),
    group: $t('page.dashboard.groupIntegration'),
    date: $t('page.dashboard.justNow'),
    url: '/ai/knowledge',
  },
  {
    title: $t('page.dashboard.projectShare'),
    icon: 'carbon:share',
    color: PROJECT_COLORS[5],
    content: $t('page.dashboard.projectShareContent'),
    group: $t('page.dashboard.groupIntegration'),
    date: $t('page.dashboard.justNow'),
    url: '/ai/knowledge',
  },
]);

// ---- 待办（无后端接口，标注演示数据）----
const todoItems: WorkbenchTodoItem[] = [
  {
    title: $t('page.dashboard.todoKbDocs'),
    content: $t('page.dashboard.todoKbDocsContent'),
    completed: false,
    date: $t('page.dashboard.today'),
  },
  {
    title: $t('page.dashboard.todoConfigModel'),
    content: $t('page.dashboard.todoConfigModelContent'),
    completed: false,
    date: $t('page.dashboard.today'),
  },
  {
    title: $t('page.dashboard.todoShare'),
    content: $t('page.dashboard.todoShareContent'),
    completed: true,
    date: $t('page.dashboard.yesterday'),
  },
  {
    title: $t('page.dashboard.todoTestRecall'),
    content: $t('page.dashboard.todoTestRecallContent'),
    completed: false,
    date: $t('page.dashboard.thisWeek'),
  },
  {
    title: $t('page.dashboard.todoViewStats'),
    content: $t('page.dashboard.todoViewStatsContent'),
    completed: false,
    date: $t('page.dashboard.thisWeek'),
  },
];

// ---- 动态趋势（后端日志，失败/不足时标注演示数据）----

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

function onProjectClick(item: WorkbenchProjectItem) {
  if (item.url?.startsWith('/')) {
    router.push(item.url).catch((error) => {
      console.error('Navigation failed:', error);
    });
  }
}
</script>

<template>
  <div class="p-5">
    <!-- 页头：问候 + 右侧炫彩计数 -->
    <WorkbenchHeader
      :avatar="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
    >
      <template #title>{{ welcomeTitle }}</template>
      <template #description>{{ $t('page.dashboard.headerDesc') }}</template>
      <template #actions>
        <div class="flex items-center gap-6 md:gap-10">
          <div class="flex flex-col items-end">
            <span class="text-xs text-muted-foreground">{{
              $t('page.dashboard.users')
            }}</span>
            <span
              class="text-2xl font-bold tabular-nums leading-none"
              :style="{
                background: BRAND_GRAD,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }"
              >{{ stats.userCount }}</span>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-xs text-muted-foreground">{{
              $t('page.dashboard.online')
            }}</span>
            <span
              class="text-2xl font-bold tabular-nums leading-none"
              :style="{
                background: BRAND_GRAD,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }"
              >{{ stats.onlineCount }}</span>
          </div>
          <div class="flex flex-col items-end">
            <span class="text-xs text-muted-foreground">{{
              $t('page.dashboard.logs')
            }}</span>
            <span
              class="text-2xl font-bold tabular-nums leading-none"
              :style="{
                background: BRAND_GRAD,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }"
              >{{ stats.logCount }}</span>
          </div>
        </div>
      </template>
    </WorkbenchHeader>

    <!-- 今日概览指标条 -->
    <div class="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
      <div
        v-for="(m, i) in metricCards"
        :key="m.key"
        class="metric-card group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4"
        :style="{ '--glow': m.glow, animationDelay: `${i * 60}ms` }"
      >
        <span
          class="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-90"
          :style="{ background: m.grad }"
        ></span>
        <div class="relative flex items-center gap-3">
          <span
            class="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-white shadow-lg"
            :style="{ background: m.grad, boxShadow: `0 6px 16px ${m.glow}` }"
          >
            <span :class="m.icon" class="size-5"></span>
          </span>
          <div class="min-w-0">
            <p class="truncate text-xs text-muted-foreground">{{ m.label }}</p>
            <p
              class="truncate text-2xl font-bold tabular-nums leading-tight tracking-tight"
              :style="{
                background: m.grad,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }"
            >
              {{ m.value }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 动态趋势 + 快捷导航 -->
    <div class="mt-5 flex flex-col gap-4 xl:flex-row">
      <div class="min-w-0 flex-1">
        <Spin :spinning="trendLoading">
          <WorkbenchTrends
            v-if="trendsLoaded && trendItems.length > 0"
            :items="trendItems"
            :title="
              usingDemoTrends
                ? `${$t('page.dashboard.latestActivity')}${$t('page.dashboard.demoSuffix')}`
                : $t('page.dashboard.latestActivity')
            "
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
      <div class="flex w-full flex-col gap-4 xl:w-[320px]">
        <WorkbenchQuickNav
          :items="quickNavItems"
          :title="$t('page.dashboard.quickNav')"
          @click="navTo"
        />
      </div>
    </div>

    <!-- 我的项目 -->
    <div class="mt-5">
      <WorkbenchProject
        :items="projectItems"
        :title="$t('page.dashboard.myProjects')"
        @click="onProjectClick"
      >
        <template #content="{ item }">
          <div
            class="text-muted-foreground mt-3 flex h-9 items-center text-[13px]"
          >
            {{ item.content }}
          </div>
        </template>
        <template #footer="{ item }">
          <div
            class="text-muted-foreground flex w-full justify-between text-xs"
          >
            <span class="flex items-center gap-1">
              <span class="i-lucide-folder size-3"></span>
              {{ item.group }}
            </span>
            <span>{{ item.date }}</span>
          </div>
        </template>
      </WorkbenchProject>
    </div>

    <!-- 待办事项（演示数据，标注） -->
    <div class="mt-5 flex flex-col gap-4 xl:flex-row">
      <div class="min-w-0 flex-1">
        <WorkbenchTodo
          :items="todoItems"
          :title="`${$t('page.dashboard.todoTitle')}${$t('page.dashboard.demoSuffix')}`"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.metric-card {
  transition:
    transform 0.25s ease,
    border-color 0.25s ease,
    box-shadow 0.25s ease;
  animation: metric-in 0.4s ease-out both;
}

.metric-card:hover {
  border-color: hsl(var(--primary) / 40%);
  box-shadow:
    0 8px 24px hsl(var(--foreground) / 8%),
    0 0 24px var(--glow);
  transform: translateY(-2px);
}

@keyframes metric-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}
</style>
