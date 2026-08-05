<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { useWatermark } from '@vben/hooks';
import { BookOpenText, CircleHelp, SvgGithubIcon } from '@vben/icons';
import {
  BasicLayout,
  LockScreen,
  Notification,
  UserDropdown,
} from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import { deleteMessage } from '#/api/system/message';
import { getProfile } from '#/api/system/profile';
import { useMessages } from '#/hooks/use-messages';
import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import LoginForm from '#/views/_core/authentication/login.vue';
import MessagePreview from '#/views/system/_shared/message-preview.vue';

const {
  notifications,
  recentMessages,
  unreadCount,
  refresh: refreshMessages,
  markRead: markMessageRead,
  markAllRead: markAllMessagesRead,
  connectSse,
} = useMessages();

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();
const showDot = computed(() => unreadCount.value > 0);

// 当前用户邮箱（/user/profile 获取，供头像下拉展示）
const userEmail = ref('');
// 当前用户角色名（取 /user/info roles 首个）
const userRoleName = computed(
  () => userStore.userInfo?.roles?.[0] ?? userStore.userInfo?.realName ?? '',
);

// 登录后拉取站内信、个人信息并建立 SSE 实时推送
onMounted(async () => {
  if (userStore.userInfo?.userId) {
    await refreshMessages();
    await connectSse();
    const profile = await getProfile();
    userEmail.value = profile.email ?? '';
  }
});

// 项目外链（占位 URL，ypbin-admin 仓库就绪后替换）
const YPBIN_GITHUB_URL = 'https://github.com/wenbin-wb/ypbin-admin-ui';
const YPBIN_DOC_URL = 'https://github.com/wenbin-wb/ypbin-admin-ui#readme';

const menus = computed(() => [
  {
    handler: () => {
      router.push({ name: 'Profile' });
    },
    icon: 'lucide:user',
    text: $t('page.auth.profile'),
  },
  {
    handler: () => {
      openWindow(YPBIN_DOC_URL, {
        target: '_blank',
      });
    },
    icon: BookOpenText,
    text: $t('ui.widgets.document'),
  },
  {
    handler: () => {
      openWindow(YPBIN_GITHUB_URL, {
        target: '_blank',
      });
    },
    icon: SvgGithubIcon,
    text: 'GitHub',
  },
  {
    handler: () => {
      openWindow(`${YPBIN_GITHUB_URL}/issues`, {
        target: '_blank',
      });
    },
    icon: CircleHelp,
    text: $t('ui.widgets.qa'),
  },
]);

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

async function handleLogout() {
  await authStore.logout(false);
}

function handleNoticeClear() {
  markAllMessagesRead();
}

function markRead(id: number | string) {
  markMessageRead(id);
}

function remove(id: number | string) {
  // 站内信为服务端数据：真删并刷新铃铛列表，不做掩盖问题的假删除
  deleteMessage(String(id)).then(() => refreshMessages());
}

function handleMakeAll() {
  markAllMessagesRead();
}

// 查看全部：跳转站内信中心
const viewAll = () => {
  router.push({ name: 'MyMessage' });
};

// 铃铛条目点击：标记已读并弹出详情（复用通用富文本预览组件）
const previewVisible = ref(false);
const previewData = ref<Record<string, any>>({});
function handleClick(item: NotificationItem) {
  if (item.id) {
    markMessageRead(String(item.id));
    // 从完整数据里取该条（id 统一转字符串比较，避免 number/string 不匹配），复用预览组件展示富文本正文
    const full = recentMessages.value.find(
      (m) => String(m.id) === String(item.id),
    );
    if (full) {
      previewData.value = full;
    } else {
      // 兜底：完整数据未命中时用列表项自身展示
      previewData.value = {
        title: item.title,
        content: item.message,
        createTime: item.date,
      };
    }
    previewVisible.value = true;
  }
}

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
  }),
  async ({ enable, content, isDark: isDarkValue }) => {
    if (enable) {
      const watermarkColor = isDarkValue
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.12)';

      await updateWatermark({
        advancedStyle: {
          colorStops: [
            {
              color: watermarkColor,
              offset: 0,
            },
            {
              color: watermarkColor,
              offset: 1,
            },
          ],
          type: 'linear',
        },
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout
    :avatar
    :text="userStore.userInfo?.realName"
    @clear-preferences-and-logout="handleLogout"
    @logout="handleLogout"
  >
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        :description="userEmail"
        :tag-text="userRoleName"
        @clear-preferences-and-logout="handleLogout"
        @logout="handleLogout"
      />
    </template>
    <template #notification>
      <Notification
        :dot="showDot"
        :notifications="notifications"
        @clear="handleNoticeClear"
        @read="(item) => item.id && markRead(item.id)"
        @remove="(item) => item.id && remove(item.id)"
        @make-all="handleMakeAll"
        @on-click="handleClick"
        @view-all="viewAll"
      />
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>

  <!-- 注意：BasicLayout 无默认插槽（页面内容由内部 RouterView 渲染），
       放在 BasicLayout 内部的普通元素不会挂载；故消息预览弹窗作为兄弟节点渲染 -->
  <MessagePreview v-model:open="previewVisible" :data="previewData" />
</template>
