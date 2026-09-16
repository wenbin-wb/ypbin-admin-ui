import { createApp, watchEffect } from 'vue';

import { registerAccessDirective } from '@vben/access';
import { registerLoadingDirective } from '@vben/common-ui/es/loading';
import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import { initStores, useAccessStore } from '@vben/stores';
import '@vben/styles';
import '@vben/styles/antd';
import { initTracking } from '@vben/tracking';

import { useTitle } from '@vueuse/core';

import { $t, setupI18n } from '#/locales';

import { initComponentAdapter } from './adapter/component';
import { initSetupVbenForm } from './adapter/form';
import App from './app.vue';
import { router } from './router';

async function bootstrap(namespace: string) {
  // 初始化组件适配器
  await initComponentAdapter();

  // 初始化表单组件
  await initSetupVbenForm();

  // // 设置弹窗的默认配置
  // setDefaultModalProps({
  //   fullscreenButton: false,
  // });
  // // 设置抽屉的默认配置
  // setDefaultDrawerProps({
  //   zIndex: 1020,
  // });

  const app = createApp(App);

  // 注册v-loading指令
  registerLoadingDirective(app, {
    loading: 'loading', // 在这里可以自定义指令名称，也可以明确提供false表示不注册这个指令
    spinning: 'spinning',
  });

  // 国际化 i18n 配置
  await setupI18n(app);

  // 配置 pinia-tore
  await initStores(app, { namespace });

  // 安装权限指令
  registerAccessDirective(app);

  // 初始化 tippy
  const { initTippy } = await import('@vben/common-ui/es/tippy');
  initTippy(app);

  // 配置路由及路由守卫
  app.use(router);

  // 埋点：只有配置了 VITE_GLOB_TRACK_URL 才真正启用；未配置时 SDK 会打印告警且不安装任何采集器
  // （上报走 SDK 自己的通道，不复用 requestClient，避免与全局错误提示/加载态互相干扰）
  initTracking(app, router, {
    appId: 'ypbin-admin-ui',
    // 令牌与业务请求客户端**同源**（同一个 accessStore.accessToken，见 api/request.ts 的
    // 请求拦截器）。这里传回调而非令牌值：登录/登出/过期都会改变令牌，回调每次都取最新值；
    // 未登录时返回 undefined，SDK 端退化为匿名上报（不阻断上报）。
    getToken: () => useAccessStore().accessToken ?? undefined,
    url: useAppConfig(import.meta.env, import.meta.env.PROD).trackURL,
  });

  // 配置Motion插件
  const { MotionPlugin } = await import('@vben/plugins/motion');
  app.use(MotionPlugin);

  // 动态更新标题
  watchEffect(() => {
    if (preferences.app.dynamicTitle) {
      const routeTitle = router.currentRoute.value.meta?.title;
      const pageTitle =
        (routeTitle ? `${$t(routeTitle)} - ` : '') + preferences.app.name;
      useTitle(pageTitle);
    }
  });

  app.mount('#app');
}

export { bootstrap };
