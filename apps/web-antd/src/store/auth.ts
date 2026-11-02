import type { Recordable, UserInfo } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { notification } from 'ant-design-vue';
import { defineStore } from 'pinia';

import { getAccessCodesApi, getUserInfoApi, loginApi, logoutApi } from '#/api';
import { $t } from '#/locales';
import {
  CHANGE_PASSWORD_PATH,
  clearMustChangePassword,
  markMustChangePassword,
} from '#/utils/pwd-change';

export const useAuthStore = defineStore('auth', () => {
  const accessStore = useAccessStore();
  const userStore = useUserStore();
  const router = useRouter();

  const loginLoading = ref(false);

  /**
   * 异步处理登录操作
   * Asynchronously handle the login process
   * @param params 登录表单数据
   */
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    let userInfo: null | UserInfo = null;
    try {
      loginLoading.value = true;
      const { accessToken, mustChangePassword } = await loginApi(params);

      // 如果成功获取到 accessToken
      if (accessToken) {
        if (mustChangePassword) {
          // 改密前拉用户信息/权限码会被网关拦截：只写令牌并直达改密页
          accessStore.setAccessToken(accessToken);
          markMustChangePassword();
          await router.push(CHANGE_PASSWORD_PATH);
        } else {
          clearMustChangePassword();
          userInfo = await completeLogin(accessToken, onSuccess);
        }
      }
    } finally {
      loginLoading.value = false;
    }

    return {
      userInfo,
    };
  }

  /**
   * 第三方登录：拿到 accessToken 后与账号密码登录走同一收尾流程；
   * 初始口令账号同样先跳到改密页。
   */
  async function socialLogin(
    accessToken: string,
    mustChangePassword?: boolean,
    onSuccess?: () => Promise<void> | void,
  ) {
    if (mustChangePassword) {
      accessStore.setAccessToken(accessToken);
      markMustChangePassword();
      await router.push(CHANGE_PASSWORD_PATH);
      return null;
    }
    clearMustChangePassword();
    return completeLogin(accessToken, onSuccess);
  }

  /**
   * 登录成功后的公共收尾：写令牌、拉取用户信息与权限码、跳转首页
   */
  async function completeLogin(
    accessToken: string,
    onSuccess?: () => Promise<void> | void,
  ) {
    accessStore.setAccessToken(accessToken);

    // 获取用户信息并存储到 accessStore 中
    const [userInfo, accessCodes] = await Promise.all([
      fetchUserInfo(),
      getAccessCodesApi(),
    ]);

    userStore.setUserInfo(userInfo);
    accessStore.setAccessCodes(accessCodes);

    if (accessStore.loginExpired) {
      accessStore.setLoginExpired(false);
    } else {
      onSuccess
        ? await onSuccess?.()
        : await router.push(
            userInfo.homePath || preferences.app.defaultHomePath,
          );
    }

    if (userInfo?.realName) {
      notification.success({
        description: `${$t('authentication.loginSuccessDesc')}:${userInfo?.realName}`,
        duration: 3,
        message: $t('authentication.loginSuccess'),
      });
    }

    return userInfo;
  }

  const isLoggingOut = ref(false); // 防重入：会话过期（HTTP 401）与主动登出可能并发触发

  async function logout(redirect: boolean = true) {
    if (isLoggingOut.value) {
      return;
    }
    isLoggingOut.value = true;
    try {
      try {
        // 会话过期场景下 handleSessionExpired 会先清空 accessToken 再调 logout：
        // 令牌已空时无法吊销会话，跳过 logoutApi（服务端会以 HTTP 401 应答并再次进入
        // handleSessionExpired → logout，形成递归）；业务 code-401 的短路见 request.ts。
        if (accessStore.accessToken) {
          await logoutApi();
        }
      } catch {
        // 不做任何处理
      }
      resetAllStores();
      accessStore.setLoginExpired(false);
      clearMustChangePassword();

      // 回登录页带上当前路由地址
      await router.replace({
        path: LOGIN_PATH,
        query: redirect
          ? {
              redirect: encodeURIComponent(router.currentRoute.value.fullPath),
            }
          : {},
      });
    } finally {
      isLoggingOut.value = false;
    }
  }

  async function fetchUserInfo() {
    const userInfo = await getUserInfoApi();
    userStore.setUserInfo(userInfo);
    return userInfo;
  }

  function $reset() {
    loginLoading.value = false;
  }

  return {
    $reset,
    authLogin,
    fetchUserInfo,
    loginLoading,
    logout,
    socialLogin,
  };
});
