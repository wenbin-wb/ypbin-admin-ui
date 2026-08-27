<script lang="ts" setup>
import type {
  WorkbenchProjectItem,
  WorkbenchQuickNavItem,
  WorkbenchTodoItem,
  WorkbenchTrendItem,
} from '@vben/common-ui';

import { computed, onMounted, ref } from 'vue';
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

import { getLatestLogs } from '#/api';
import { $t } from '#/locales';

const userStore = useUserStore();
const router = useRouter();

// ---- 统一视觉（与统计看板/分析页同语言）----
const BRAND_GRAD =
  'linear-gradient(135deg, hsl(var(--primary)), hsl(245 82% 67%))';

// ---- 今日概览指标（演示数据）----
const metricCards = computed(() => [
  {
    key: 'kb',
    label: '知识库',
    value: '12',
    icon: 'i-lucide-database',
    grad: 'linear-gradient(135deg, hsl(var(--primary)), hsl(245 82% 67%))',
    glow: 'hsl(var(--primary) / 30%)',
  },
  {
    key: 'doc',
    label: '文档',
    value: '386',
    icon: 'i-lucide-file-text',
    grad: 'linear-gradient(135deg, hsl(245 82% 67%), hsl(161 90% 43%))',
    glow: 'hsl(245 82% 67% / 30%)',
  },
  {
    key: 'chat',
    label: '今日会话',
    value: '46',
    icon: 'i-lucide-message-square',
    grad: 'linear-gradient(135deg, hsl(199 89% 48%), hsl(161 90% 43%))',
    glow: 'hsl(199 89% 48% / 30%)',
  },
  {
    key: 'qa',
    label: '今日问答',
    value: '128',
    icon: 'i-lucide-message-circle-question',
    grad: 'linear-gradient(135deg, hsl(32 95% 44%), hsl(16 90% 50%))',
    glow: 'hsl(32 95% 44% / 30%)',
  },
]);

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

// ---- 项目卡片（演示数据，颜色用统一数据色板循环）----
const PROJECT_COLORS = [
  '#0066f5', // 蓝（primary）
  '#7c7cf0', // 靛紫
  '#0ec9a3', // 青绿
  '#f0b429', // 黄
  '#f2547b', // 红
  '#5a6cf0', // 蓝紫
];

const projectItems: WorkbenchProjectItem[] = [
  {
    title: 'AI 知识库',
    icon: 'carbon:database-enterprise',
    color: PROJECT_COLORS[0],
    content: '12 个知识库 · 386 篇文档 · 向量化 100%',
    group: '知识管理',
    date: '2 小时前更新',
    url: '/ai/knowledge',
  },
  {
    title: '智能对话',
    icon: 'carbon:chat-bot',
    color: PROJECT_COLORS[1],
    content: '1,286 次会话 · 今日 46 次 · 平均延迟 1.2s',
    group: 'AI 应用',
    date: '刚刚',
    url: '/ai/chat',
  },
  {
    title: '模型配置',
    icon: 'carbon:ai-status',
    color: PROJECT_COLORS[2],
    content: '对话 2 个 · 向量化 1 个 · 全部在线',
    group: '资源配置',
    date: '昨天',
    url: '/ai/config',
  },
  {
    title: '数据统计',
    icon: 'carbon:chart-line',
    color: PROJECT_COLORS[3],
    content: '本周问答 +18% · 热词 46 个',
    group: '运营分析',
    date: '今天 09:20',
    url: '/ai/usage',
  },
  {
    title: '网页挂件',
    icon: 'carbon:web-services-container',
    color: PROJECT_COLORS[4],
    content: '3 个站点已嵌入 · 累计问答 512 次',
    group: '对外集成',
    date: '3 天前',
    url: '/ai/knowledge',
  },
  {
    title: '公开分享',
    icon: 'carbon:share',
    color: PROJECT_COLORS[5],
    content: '2 个分享链接生效 · 今日访问 89',
    group: '对外集成',
    date: '5 天前',
    url: '/ai/knowledge',
  },
];

// ---- 待办（演示数据）----
const todoItems: WorkbenchTodoItem[] = [
  {
    title: '为知识库补充产品文档',
    content: '上传 PDF / Markdown 到「产品手册」',
    completed: false,
    date: '今天',
  },
  {
    title: '配置对话模型与向量化模型',
    content: '在【AI 配置】中新增并设为默认',
    completed: false,
    date: '今天',
  },
  {
    title: '启用知识库公开分享',
    content: '设置有效期与访问密码后对外发布',
    completed: true,
    date: '昨天',
  },
  {
    title: '测试检索召回效果',
    content: '使用检索测试器调整 topK 与阈值',
    completed: false,
    date: '本周',
  },
  {
    title: '查看本周统计看板',
    content: '关注问答趋势与搜索热词',
    completed: false,
    date: '本周',
  },
];

// ---- 环境信息（演示数据）----
const envItems = [
  {
    label: '后端服务',
    value: '在线',
    ok: true,
    icon: 'i-lucide-server',
    color: '#0ec9a3',
  },
  {
    label: '数据库',
    value: '正常',
    ok: true,
    icon: 'i-lucide-database',
    color: '#0066f5',
  },
  {
    label: '向量化服务',
    value: '待配置',
    ok: false,
    icon: 'i-lucide-box',
    color: '#f0b429',
  },
  {
    label: 'AI 模型',
    value: '2 个对话 · 1 个向量',
    ok: true,
    icon: 'i-lucide-sparkles',
    color: '#7c7cf0',
  },
  {
    label: '系统版本',
    value: 'ypbin-admin v1.0.0',
    ok: true,
    icon: 'i-lucide-package',
    color: '#f2547b',
  },
  {
    label: '部署环境',
    value: '演示 Demo',
    ok: true,
    icon: 'i-lucide-globe',
    color: '#5a6cf0',
  },
];

// ---- 动态趋势（后端日志为空时用演示数据兜底）----
const avatars = [
  'svg:avatar-1',
  'svg:avatar-2',
  'svg:avatar-3',
  'svg:avatar-4',
];

const DEMO_TRENDS: WorkbenchTrendItem[] = [
  {
    avatar: 'svg:avatar-1',
    title: '管理员',
    content: '创建了知识库「产品手册」并上传 12 篇文档',
    date: '10 分钟前',
  },
  {
    avatar: 'svg:avatar-2',
    title: '运营同学',
    content: '通过网页挂件完成了一次 AI 问答（耗时 1.1s）',
    date: '32 分钟前',
  },
  {
    avatar: 'svg:avatar-3',
    title: '系统',
    content: '文档「快速上手指南.md」向量化完成（12 个分块）',
    date: '1 小时前',
  },
  {
    avatar: 'svg:avatar-4',
    title: '管理员',
    content: '更新了知识库「FAQ」的分享链接有效期',
    date: '2 小时前',
  },
  {
    avatar: 'svg:avatar-1',
    title: '系统',
    content: '每日统计已生成：问答 46 次，检索 120 次',
    date: '今天 08:00',
  },
  {
    avatar: 'svg:avatar-2',
    title: '运营同学',
    content: '在检索测试器中测试「产品有哪些特性」topK=5',
    date: '昨天 18:30',
  },
];

const trendError = ref(false);
const trendItems = ref<WorkbenchTrendItem[]>([]);
const trendLoading = ref(true);
const trendsLoaded = ref(false);
const usingDemoTrends = ref(false);

async function loadTrends() {
  trendError.value = false;
  trendLoading.value = true;
  try {
    const logs = await getLatestLogs(9);
    if (logs && logs.length > 0) {
      trendItems.value = logs.map((log, index) => ({
        avatar: avatars[index % avatars.length] as string,
        content: `${log.module ? `[${log.module}] ` : ''}${log.description ?? ''}`,
        date: log.operateTime,
        title: log.operateUserIdName || log.operateUserId,
      }));
      usingDemoTrends.value = false;
    } else {
      // 演示模式：日志为空（如演示环境）时展示示例活动流
      trendItems.value = DEMO_TRENDS;
      usingDemoTrends.value = true;
    }
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

function onProjectClick(item: WorkbenchProjectItem) {
  if (item.url?.startsWith('/')) {
    router.push(item.url).catch(() => {});
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
      <template #description>欢迎回来，今天也要高效工作 🚀</template>
      <template #actions>
        <div class="flex items-center gap-6 md:gap-10">
          <div class="flex flex-col items-end">
            <span class="text-xs text-muted-foreground">待办</span>
            <span
              class="text-2xl font-bold tabular-nums leading-none"
              :style="{
                background: BRAND_GRAD,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }"
              >2/5</span
            >
          </div>
          <div class="flex flex-col items-end">
            <span class="text-xs text-muted-foreground">项目</span>
            <span
              class="text-2xl font-bold tabular-nums leading-none"
              :style="{
                background: BRAND_GRAD,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }"
              >6</span
            >
          </div>
          <div class="flex flex-col items-end">
            <span class="text-xs text-muted-foreground">今日问答</span>
            <span
              class="text-2xl font-bold tabular-nums leading-none"
              :style="{
                background: BRAND_GRAD,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }"
              >128</span
            >
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
            <span :class="`${m.icon} size-5`"></span>
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
                ? `${$t('page.dashboard.latestActivity')}（演示数据）`
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
      <div class="w-full xl:w-[320px]">
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
        title="我的项目"
        @click="onProjectClick"
      >
        <template #content="{ item }">
          <div class="text-muted-foreground mt-3 flex h-9 items-center text-[13px]">
            {{ item.content }}
          </div>
        </template>
        <template #footer="{ item }">
          <div class="text-muted-foreground flex w-full justify-between text-xs">
            <span class="flex items-center gap-1">
              <span class="i-lucide-folder size-3" />
              {{ item.group }}
            </span>
            <span>{{ item.date }}</span>
          </div>
        </template>
      </WorkbenchProject>
    </div>

    <!-- 待办事项 + 环境信息 -->
    <div class="mt-5 flex flex-col gap-4 xl:flex-row">
      <div class="min-w-0 flex-1">
        <WorkbenchTodo :items="todoItems" title="待办事项" />
      </div>
      <div class="w-full xl:w-[340px]">
        <div class="rounded-xl border border-border/80 bg-card p-5">
          <h3 class="text-base font-semibold">环境信息</h3>
          <ul class="mt-3 flex flex-col divide-y divide-border/70">
            <li
              v-for="e in envItems"
              :key="e.label"
              class="flex items-center justify-between gap-3 py-2.5"
            >
              <span class="flex min-w-0 items-center gap-2.5">
                <span
                  class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-white"
                  :style="{ background: e.color }"
                >
                  <span :class="`${e.icon} size-3.5`"></span>
                </span>
                <span class="truncate text-[13px]">{{ e.label }}</span>
              </span>
              <span
                class="flex shrink-0 items-center gap-1.5 text-xs"
                :class="e.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'"
              >
                <span
                  class="size-1.5 rounded-full"
                  :class="e.ok ? 'bg-emerald-500' : 'bg-amber-500'"
                ></span>
                {{ e.value }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metric-card {
  animation: metric-in 0.4s ease-out both;
  transition:
    transform 0.25s ease,
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}
.metric-card:hover {
  transform: translateY(-2px);
  border-color: hsl(var(--primary) / 40%);
  box-shadow:
    0 8px 24px hsl(var(--foreground) / 8%),
    0 0 24px var(--glow);
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
