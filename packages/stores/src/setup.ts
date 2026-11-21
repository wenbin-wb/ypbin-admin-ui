import type { Pinia } from 'pinia';

import type { App } from 'vue';

import { createPinia } from 'pinia';
import SecureLS from 'secure-ls';

let pinia: Pinia;

type SecureLSStorage = {
  get(key: string): any;
  set(key: string, value: unknown): void;
};

type SecureLSCtor = new (config?: {
  encodingType?: string;
  encryptionSecret?: string;
  isCompression?: boolean;
  metaKey?: string;
}) => SecureLSStorage;

const secureLSModule = SecureLS as unknown as {
  default?: SecureLSCtor;
  SecureLS?: SecureLSCtor;
};

const SecureLSConstructor =
  secureLSModule.default ??
  secureLSModule.SecureLS ??
  (SecureLS as unknown as SecureLSCtor);

export interface InitStoreOptions {
  /**
   * @zh_CN 应用名,由于 @vben/stores 是公用的，后续可能有多个app，为了防止多个app缓存冲突，可在这里配置应用名,应用名将被用于持久化的前缀
   */
  namespace: string;
}

/**
 * 生产构建中禁止使用的占位符密钥。
 *
 * 与 `apps/web-antd/.env.development` 的本地默认值保持一致：开发环境允许用它把项目跑起来，
 * 但生产构建如果仍是这个值，pinia 持久化等于只做了「混淆」而不是加密。
 */
const PLACEHOLDER_STORE_SECURE_KEY = 'please-replace-me-with-your-own-key';

/**
 * 校验 pinia 持久化加密密钥。
 *
 * 设计取舍：**开发环境只告警、不阻断**（本地开箱即用，不改默认值）；**生产环境直接抛错**，
 * 宁可启动失败也不能让用户数据以「假加密」形态静默写进 localStorage。
 *
 * 密钥不硬编码进产物：生产值由部署环境注入（见 `apps/web-antd/.env.production` 注释与 CI 门禁）。
 */
function assertStoreSecureKey(key: string | undefined): void {
  const normalized = key?.trim() ?? '';
  if (normalized && normalized !== PLACEHOLDER_STORE_SECURE_KEY) {
    return;
  }
  const message =
    '[stores] VITE_APP_STORE_SECURE_KEY 未配置或仍是占位符：pinia 持久化只会得到弱密钥加密（等同于混淆/明文）。' +
    '生产构建必须通过部署环境注入高强度随机密钥。';
  if (import.meta.env.PROD) {
    console.error(message);
    throw new Error(message);
  }
  // 测试环境（MODE=test）不刷屏；本地开发（DEV）保留醒目告警，但不阻断。
  if (import.meta.env.DEV) {
    console.warn(message);
  }
}

/**
 * @zh_CN 初始化pinia
 */
export async function initStores(app: App, options: InitStoreOptions) {
  const { createPersistedState } = await import('pinia-plugin-persistedstate');
  pinia = createPinia();
  const { namespace } = options;
  assertStoreSecureKey(import.meta.env.VITE_APP_STORE_SECURE_KEY);
  const ls = new SecureLSConstructor({
    encodingType: 'aes',
    encryptionSecret: import.meta.env.VITE_APP_STORE_SECURE_KEY,
    isCompression: true,
    metaKey: `${namespace}-secure-meta`,
  });
  pinia.use(
    createPersistedState({
      // key $appName-$store.id
      key: (storeKey) => `${namespace}-${storeKey}`,
      storage: import.meta.env.DEV
        ? localStorage
        : {
            getItem(key) {
              return ls.get(key);
            },
            setItem(key, value) {
              ls.set(key, value);
            },
          },
    }),
  );
  app.use(pinia);
  return pinia;
}

export function resetAllStores() {
  if (!pinia) {
    console.error('Pinia is not installed');
    return;
  }
  const allStores = (pinia as any)._s;
  for (const [_key, store] of allStores) {
    store.$reset();
  }
}
