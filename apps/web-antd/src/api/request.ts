/**
 * 该文件可自行根据业务逻辑进行调整
 */
import type { RequestClientOptions } from '@vben/request';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import {
  authenticateResponseInterceptor,
  defaultResponseInterceptor,
  errorMessageResponseInterceptor,
  RequestClient,
} from '@vben/request';
import { useAccessStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

/**
 * 会话过期统一入口：清空 accessToken，并按「登录过期模式」展示过期弹窗或执行登出。
 * 与 requestClient 的 401 拦截逻辑共用同一实现，供绕过 requestClient 的裸 fetch
 * （如 SSE 流式对话）在收到 401 时复用。
 */
export async function handleSessionExpired() {
  const accessStore = useAccessStore();
  const authStore = useAuthStore();
  accessStore.setAccessToken(null);
  if (
    preferences.app.loginExpiredMode === 'modal' &&
    accessStore.isAccessChecked
  ) {
    accessStore.setLoginExpired(true);
  } else {
    await authStore.logout();
  }
}

function createRequestClient(baseURL: string, options?: RequestClientOptions) {
  const client = new RequestClient({
    ...options,
    baseURL,
  });

  /**
   * 重新认证逻辑
   */
  async function doReAuthenticate() {
    console.warn('Access token or refresh token is invalid or expired. ');
    await handleSessionExpired();
  }

  /**
   * 刷新 token 逻辑（未启用）。
   *
   * 后端不存在 /auth/refresh 端点（accessToken 过期即重新登录），因此不做任何请求；
   * enableRefreshToken 恒为 false 时该分支不会被触发，保留桩实现防止被误启用。
   */
  async function doRefreshToken(): Promise<string> {
    throw new Error('Refresh token is not enabled.');
  }

  function formatToken(token: null | string) {
    return token ? `Bearer ${token}` : null;
  }

  // 请求头处理
  client.addRequestInterceptor({
    fulfilled: async (config) => {
      const accessStore = useAccessStore();

      config.headers.Authorization = formatToken(accessStore.accessToken);
      config.headers['Accept-Language'] = preferences.app.locale;
      return config;
    },
  });

  // 拦截业务 code 401（未授权）
  client.addResponseInterceptor({
    fulfilled: (response) => {
      const { config, data } = response;
      if (data && data.code === 401) {
        // 主动登出（/auth/logout）即使返回 401 也不必再触发重登流程，避免递归
        const isLogoutCall = String(config?.url ?? '').endsWith('/auth/logout');
        if (!isLogoutCall) {
          doReAuthenticate();
        }
        // 中断请求链路
        throw new Error(data.message || 'Unauthorized');
      }
      return response;
    },
  });

  // 返回数据格式化
  client.addResponseInterceptor(
    defaultResponseInterceptor({
      codeField: 'code',
      dataField: 'data',
      // ypbin 统一响应：成功码为 200（HTTP 恒 200，由业务 code 区分）
      successCode: 200,
    }),
  );

  // token过期的处理
  client.addResponseInterceptor(
    authenticateResponseInterceptor({
      client,
      doReAuthenticate,
      doRefreshToken,
      enableRefreshToken: preferences.app.enableRefreshToken,
      formatToken,
    }),
  );

  // 通用的错误处理,如果没有进入上面的错误处理逻辑，就会进入这里
  client.addResponseInterceptor(
    errorMessageResponseInterceptor((msg: string, error) => {
      // 这里可以根据业务进行定制,你可以拿到 error 内的信息进行定制化处理，根据不同的 code 做不同的提示，而不是直接使用 message.error 提示 msg
      // 当前mock接口返回的错误字段是 error 或者 message
      const responseData = error?.response?.data ?? {};
      const errorMessage = responseData?.error ?? responseData?.message ?? '';
      // 如果没有错误信息，则会根据状态码进行提示
      message.error(errorMessage || msg);
    }),
  );

  return client;
}

export const requestClient = createRequestClient(apiURL, {
  responseReturn: 'data',
});

export const baseRequestClient = new RequestClient({ baseURL: apiURL });
