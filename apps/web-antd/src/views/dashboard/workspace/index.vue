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
  {
    avatar: 'svg:avatar-3',
    title: '管理员',
    content: '新增对话模型 deepseek-v4-flash 并设为默认',
    date: '昨天 15:12',
  },
  {
    avatar: 'svg:avatar-4',
    title: '系统',
    content: '挂件脚本 embed.js 更新（拖动 + 吸边）',
    date: '昨天 11:40',
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
    <WorkbenchHeader
      :avatar="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
    >
      <template #title>{{ welcomeTitle }}</template>
    </WorkbenchHeader>

    <!-- 第一行：活动趋势 + 快捷导航 -->
    <div class="mt-5 flex flex-col gap-4 lg:flex-row">
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
      <div class="w-full lg:w-[320px]">
        <WorkbenchQuickNav
          :items="quickNavItems"
          :title="$t('page.dashboard.quickNav')"
          @click="navTo"
        />
      </div>
    </div>

    <!-- 第二行：项目卡片 + 待办 -->
    <div class="mt-4 flex flex-col gap-4 xl:flex-row">
      <div class="min-w-0 flex-1">
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
      <div class="w-full xl:w-[340px]">
        <WorkbenchTodo :items="todoItems" title="待办事项" />
      </div>
    </div>
  </div>
</template>
