<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import type { SystemMessageApi } from '#/api/system/message';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
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

import { storeToRefs } from 'pinia';

import { getProfile } from '#/api/system/profile';
import { $t } from '#/locales';
import { useAuthStore, useMessageStore } from '#/store';
import LoginForm from '#/views/_core/authentication/login.vue';
import AssistantWidget from '#/views/ai/widgets/assistant-widget.vue';
import MessagePreview from '#/views/system/_shared/message-preview.vue';

const messageStore = useMessageStore();
const { notifications, recentMessages, unreadCount } =
  storeToRefs(messageStore);

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();
const showDot = computed(() => unreadCount.value > 0);

// 当前用户邮箱来自共享用户信息，资料保存后会立即同步头像下拉
const userEmail = computed(() => userStore.userInfo?.email ?? '');
// 当前用户角色名（取 /user/info roles 首个）
const userRoleName = computed(
  () => userStore.userInfo?.roles?.[0] ?? userStore.userInfo?.realName ?? '',
);

// 登录后并行拉取站内信、个人信息并建立 SSE 实时推送；任一失败不阻塞其余项
onMounted(() => {
  if (!userStore.userInfo?.userId) {
    return;
  }

  void messageStore.refresh().catch((error) => {
    console.error('Failed to initialize messages:', error);
  });
  void messageStore.startSse();
  void getProfile()
    .then(async (profile) => {
      const userInfo = await authStore.fetchUserInfo();
      userStore.setUserInfo({ ...userInfo, email: profile.email ?? '' });
    })
    .catch((error) => {
      console.error('Failed to load profile:', error);
    });
});

onUnmounted(messageStore.closeSse);

const YPBIN_GITHUB_URL = 'https://github.com/wenbin-wb/ypbin-admin-ui';
const YPBIN_DOC_URL = 'https://ypbin.cn';

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
  messageStore.$reset();
  await authStore.logout(false);
}

function markRead(id: string) {
  void messageStore.markRead(id);
}

function remove(id: string) {
  void messageStore.remove(id);
}

function handleMakeAll() {
  void messageStore.markAllRead();
}

// 查看全部：跳转站内信中心
const viewAll = () => {
  router.push({ name: 'MyMessage' });
};

// 铃铛条目点击：标记已读并弹出详情（复用通用富文本预览组件）
type MessagePreviewData = Pick<
  SystemMessageApi.MessageItem,
  'content' | 'createTime' | 'title'
>;

const previewVisible = ref(false);
const previewData = ref<MessagePreviewData>();
function handleClick(item: NotificationItem) {
  if (item.id === undefined) {
    return;
  }
  const id = String(item.id);
  markRead(id);
  const full = recentMessages.value.find((message) => message.id === id);
  previewData.value = full ?? {
    content: item.message,
    createTime: item.date,
    title: item.title,
  };
  previewVisible.value = true;
}

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
    realName: userStore.userInfo?.realName,
    username: userStore.userInfo?.username,
  }),
  async ({ enable, content, isDark: isDarkValue, realName, username }) => {
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
        content: content || `${username} - ${realName}`,
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
        @read="(item) => item.id !== undefined && markRead(String(item.id))"
        @remove="(item) => item.id !== undefined && remove(String(item.id))"
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
       放在 BasicLayout 内部的普通元素不会挂载；故消息预览弹窗、AI 悬浮助手作为兄弟节点渲染 -->
  <MessagePreview v-model:open="previewVisible" :data="previewData" />
  <AssistantWidget />
</template>
