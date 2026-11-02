/**
 * `check-i18n-message-compile.mjs` 的类型声明。
 *
 * 为什么需要它：测试（TypeScript）要复用门禁脚本里的 `collectLeafKeys`——**遍历口径只允许一处实现**，
 * 否则「测试认为的叶子」与「CI 门禁认为的叶子」迟早漂移，出现「测试绿、CI 绿、线上红」。
 * 而脚本本身是 .mjs（Node 直接执行，不经 TS 编译），故用与 `x.mjs` 配对的 `x.d.mts` 提供类型。
 */

/** 仓库根目录（由脚本自身 `import.meta.url` 推导）。 */
export declare const ROOT: string;

/** 基座（共享）语言包目录；**先**加载，会被应用自己的包覆盖。 */
export declare const SHARED_LOCALE_DIR: string;

/** 每个应用 = 一套独立 i18n（基座 → 应用自己，应用胜出）。 */
export declare const APP_BUNDLES: { app: string; dirs: string[] }[];

/** 被扫描的语言。 */
export declare const LANGS: string[];

/** 用真实 vue-i18n 建一个实例（`messages` 为「命名空间 → 该语言包内容」）。 */
export declare function createI18nFor(
  lang: string,
  messages: Record<string, unknown>,
): {
  locale: { value: string };
  t: (key: string) => string;
  mergeLocaleMessage: (lang: string, message: unknown) => void;
};

/**
 * 递归收集**字符串叶子**键（中间节点是命名空间对象，vue-i18n 对对象不编译）。
 * @param node 语言包对象（或任意子节点）
 * @param prefix 前缀（首次调用可省略）
 */
export declare function collectLeafKeys(
  node: unknown,
  prefix?: string,
): string[];

/** 收集**非字符串**叶子（数组/数字/布尔/null）——不被消息编译覆盖，用于如实声明覆盖边界。 */
export declare function collectNonStringLeaves(
  node: unknown,
  prefix?: string,
): string[];

/** **深合并**两个语言包对象（对齐 vue-i18n `mergeLocaleMessage` 语义）。 */
export declare function deepMergeMessages(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown>;

/** 按给定顺序读取一组目录的语言包（**后者覆盖前者，深合并**）。 */
export declare function loadDirsMessages(
  lang: string,
  dirs: string[],
): {
  files: string[];
  messages: Record<string, Record<string, unknown>>;
  usedDirs: string[];
};

/** 兼容旧用法：默认只读基座目录。 */
export declare function loadLangMessages(
  lang: string,
  dirs?: string[],
): {
  files: string[];
  messages: Record<string, Record<string, unknown>>;
  usedDirs: string[];
};

/** 按生产口径（逐应用：基座 → 应用）编译某语言的全部（或某前缀下的）叶子文案。 */
export declare function compileLang(
  lang: string,
  options?: { namespace?: string },
): {
  compiled: number;
  failures: { app: string; apps: string[]; key: string; reason: string }[];
  scannedFiles: string[];
  usedDirs: string[];
  skippedNonString: string[];
};

/** 全库扫描（默认 zh-CN + en-US）。 */
export declare function scanAll(options?: {
  languages?: string[];
  namespace?: string;
}): {
  failures: {
    app: string;
    apps: string[];
    lang: string;
    key: string;
    reason: string;
  }[];
  compiled: number;
  scannedFiles: number;
  skippedNonString: string[];
};
