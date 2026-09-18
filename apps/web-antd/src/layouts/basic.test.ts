import type { BasicUserInfo } from '@vben/types';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 水印文案的**生产调用点**测试（`apps/web-antd/src/layouts/basic.vue`）。
 *
 * 本仓未引入 `@vue/test-utils`，故沿用 avatar 测试的做法：直接调用 SFC 编译产物的
 * `setup()`（模板渲染时同样求值），只把 `useWatermark` 换成捕获参数的桩，
 * `resolveWatermarkContent` 保持 `@vben/hooks` 的真实实现——这样断言的才是
 * 「布局层实际交给水印的文案」，而不是孤立工具函数的自证。
 */
const captured: { content?: string }[] = [];

vi.mock('@vben/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vben/hooks')>();
  return {
    ...actual,
    useWatermark: () => ({
      destroyWatermark: vi.fn(),
      updateWatermark: async (options: { content?: string }) => {
        captured.push(options);
      },
      watermark: { value: undefined },
    }),
  };
});

vi.mock('@vben/preferences', () => ({
  preferences: {
    app: {
      defaultAvatar: 'default-avatar.png',
      watermark: true,
      watermarkContent: '',
    },
  },
  usePreferences: () => ({ isDark: { value: false } }),
}));

vi.mock('@vben/layouts', () => ({
  BasicLayout: { name: 'BasicLayout', template: '<div><slot /></div>' },
  LockScreen: { name: 'LockScreen', template: '<div />' },
  Notification: { name: 'Notification', template: '<div />' },
  UserDropdown: { name: 'UserDropdown', template: '<div />' },
}));

vi.mock('@vben/common-ui', () => ({
  AuthenticationLoginExpiredModal: {
    name: 'AuthenticationLoginExpiredModal',
    template: '<div><slot /></div>',
  },
}));

vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => false }),
}));

vi.mock('@vben/icons', () => ({
  BookOpenText: { name: 'BookOpenText', template: '<span />' },
  CircleHelp: { name: 'CircleHelp', template: '<span />' },
  SvgGithubIcon: { name: 'SvgGithubIcon', template: '<span />' },
}));

vi.mock('@vben/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/utils')>()),
  openWindow: vi.fn(),
}));

vi.mock('#/locales', () => ({ $t: (key: string) => key }));

vi.mock('#/api/system/profile', () => ({
  getProfile: async () => ({ email: '' }),
}));

vi.mock('#/views/_core/authentication/login.vue', () => ({
  default: { name: 'LoginForm', template: '<div />' },
}));

vi.mock('#/views/ai/widgets/assistant-widget.vue', () => ({
  default: { name: 'AssistantWidget', template: '<div />' },
}));

vi.mock('#/views/system/_shared/message-preview.vue', () => ({
  default: { name: 'MessagePreview', template: '<div />' },
}));

/**
 * 走真实调用点：`basic.vue` 在 `immediate: true` 的 watch 里同步调用
 * `updateWatermark({ content: ... })`，此处捕获它实际提交的文案。
 *
 * 测试夹具直接声明成 `BasicUserInfo`，也就顺带约束了「可空字段是类型契约的一部分」
 * （`setUserInfo` 不再需要任何 `as` 断言）。
 */
async function renderLayoutWatermark(userInfo: BasicUserInfo | null) {
  setActivePinia(createPinia());
  const { useUserStore } = await import('@vben/stores');
  const { useMessageStore } = await import('#/store');
  // 消息 store 需先实例化，`storeToRefs` 才能拿到响应式引用
  useMessageStore();
  useUserStore().setUserInfo(userInfo);

  captured.length = 0;
  const sfc = await import('./basic.vue');
  const BasicLayoutSfc = sfc.default as unknown as {
    setup: (
      props: Record<string, unknown>,
      ctx: Record<string, unknown>,
    ) => Record<string, unknown>;
  };
  BasicLayoutSfc.setup(
    {},
    { attrs: {}, emit: () => {}, expose: () => {}, slots: {} },
  );
  expect(captured).toHaveLength(1);
  return captured[0]?.content;
}

/** 构造最小可用的用户信息（后端 `real_name` 允许 NULL，故 `realName` 就是 `null`） */
function userFixture(overrides: Partial<BasicUserInfo> = {}): BasicUserInfo {
  return {
    avatar: null,
    realName: null,
    userId: '1',
    username: 'admin',
    ...overrides,
  };
}

describe('web-antd 布局水印文案（生产调用点）', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('realName 为 null 时不把 `null` 字面量写进水印', async () => {
    const content = await renderLayoutWatermark(
      userFixture({ realName: null }),
    );
    expect(content).toBe('admin');
    expect(content).not.toContain('null');
    expect(content).not.toContain('undefined');
  });

  it('userInfo 未加载（字段皆 undefined）时不写 `undefined` 字面量', async () => {
    const content = await renderLayoutWatermark(null);
    // 两个字段都取不到时不留下占位垃圾，而是空文案（水印模块的默认 content）
    expect(content).toBe('');
    expect(content).not.toContain('undefined');
    expect(content).not.toContain('null');
  });

  it('realName 为空串时同样不留悬空分隔符', async () => {
    const content = await renderLayoutWatermark(userFixture({ realName: '' }));
    expect(content).toBe('admin');
  });

  it('正常值行为不变：用户名 - 姓名', async () => {
    const content = await renderLayoutWatermark(
      userFixture({ realName: '张三' }),
    );
    expect(content).toBe('admin - 张三');
  });
});
