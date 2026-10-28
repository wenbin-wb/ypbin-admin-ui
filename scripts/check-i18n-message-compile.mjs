/**
 * i18n **文案编译**门禁（可复用库 + CLI）。
 *
 * 为什么需要它（与「键存在性」类门禁的区别，如 iot-ui 的 `check-iot-i18n-keys.mjs`）：
 * 那类门禁只证明「键**存在**」，证明不了「值能不能被编译」。2026-09-27 的线上事故正是卡在这条缝里：
 * `page.iot.debug.valueHint` 等 3 条文案写了未转义的字面 `{` `}`（如 `{"a":1}`），vue-i18n 在
 * **渲染期**编译消息时抛 `SyntaxError: Message compilation error` ⇒ 整个子树渲染成 `<!---->`
 * （内容区全白）。当时 typecheck / 构建 / 键存在性校验**全绿**——键确实存在，只是编译不过。
 *
 * 本模块用**真实 vue-i18n**（与生产同一实现，无桩）逐条编译语言包里的每个字符串叶子键，
 * 谁编译不过就**点名谁**。含未转义 `{...}` 的文案一律失败——不止 JSON 示例，
 * 正则片段（`{\d+}`）、花括号模板串同样会失败。
 *
 * 🔴 **必须按「每个应用一套 i18n」的口径编译，不能把所有目录合成一个大语言包。**
 * 生产的加载顺序（一手核实：`packages/locales/src/i18n.ts` 的 `loadLocaleMessages`）是
 * **先 `setLocaleMessage(基座 packages/locales)`，再 `mergeLocaleMessage(该应用自己的语言包)`**
 * ⇒ **应用覆盖基座**；而且每个应用是**各自独立**的 i18n 实例（各应用的 `src/locales/index.ts`
 * 各自提供 `loadMessages`），不同应用的 `system.json` 彼此无关。
 *
 * 第一版实现把 7 个目录按「应用在前、基座在后」的顺序 `{...prev, ...next}` 合并 ⇒ 优先级**正好相反**
 * （基座覆盖应用）⇒ 被基座遮蔽的同名键**编译不到**：门禁报绿，而真实页面渲染期抛错。
 * 这个漏报洞由独立复核用变异实证（把 web-antd 的 `system.role.status` 写成裸花括号 ⇒ 门禁 EXIT=0，
 * 真实 `setupI18n` 探针 `$t(...)` 抛 `Message compilation error`）。**已按生产口径重写。**
 *
 * 本仓落地实例（2026-10-28）：`system.space.extJsonPlaceholder` 的 `{"fireZone":"A"}` 就是同一个坑，
 * 而当时 typecheck / 构建全绿——本门禁一接入就点名了它（zh-CN + en-US 各一条）。
 *
 * 用法：
 *   node scripts/check-i18n-message-compile.mjs                      # 全库（zh-CN + en-US）
 *   node scripts/check-i18n-message-compile.mjs --namespace page.ai  # 只查某前缀（可复用）
 *   node scripts/check-i18n-message-compile.mjs --json               # 机器可读输出
 *
 * 自检（教训八：0 违规可能是「没跑到」）：必须真的扫到语言包文件、且编译条数达下限，
 * 否则以退出码 1 报「门禁空跑」，不允许「一个键都没编译却报绿」。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT = new URL('..', import.meta.url).pathname;

/** 基座（共享）语言包：**先**加载，会被应用自己的包覆盖。 */
export const SHARED_LOCALE_DIR = 'packages/locales/src/langs';

/**
 * 每个应用 = 一套独立的 i18n：`基座 → 应用自己`（应用胜出）。
 *
 * ⚠️ 顺序即优先级：数组里**后面的覆盖前面的**，必须把 `SHARED_LOCALE_DIR` 放在最前。
 * 新增应用时要把它的 `src/locales/langs` 加进来，否则该应用的文案不被本门禁覆盖。
 */
export const APP_BUNDLES = [
  { app: 'web-antd', dirs: ['apps/web-antd/src/locales/langs'] },
  { app: 'web-antdv-next', dirs: ['apps/web-antdv-next/src/locales/langs'] },
  { app: 'web-ele', dirs: ['apps/web-ele/src/locales/langs'] },
  { app: 'web-naive', dirs: ['apps/web-naive/src/locales/langs'] },
  { app: 'web-tdesign', dirs: ['apps/web-tdesign/src/locales/langs'] },
  { app: 'playground', dirs: ['playground/src/locales/langs'] },
];

export const LANGS = ['zh-CN', 'en-US'];

/**
 * 全库编译条数下限（限定了 `--namespace` 时改用 1）。
 * 每应用都会编译一遍「基座 + 自己」⇒ 总量远大于单目录之和；取一个保守值，
 * 只在「遍历退化 / 语言包没扫到」时触发，正常删减文案不会误报。
 */
const MIN_COMPILED = 500;

const require = createRequire(join(ROOT, 'packages/locales/package.json'));

/** 真实 vue-i18n（与生产同一实现，不做任何桩）。 */
export function createI18nFor(lang, messages) {
  const { createI18n } = require('vue-i18n');
  return createI18n({
    legacy: false,
    locale: lang,
    messages: { [lang]: messages },
  }).global;
}

/**
 * 递归收集**字符串叶子**键。
 *
 * 只迭代一层是空转：`page.iot` 下的中间节点是命名空间对象，vue-i18n 对对象**不编译**
 * （只打一条 Not found 警告），等于门禁没跑。
 *
 * 注意：数组与非字符串叶子**不由本函数返回**（vue-i18n 对它们不走消息编译路径）。
 * 这类叶子由 `collectNonStringLeaves` 单独统计并**如实报告**，避免「静默没覆盖」。
 */
export function collectLeafKeys(node, prefix = '') {
  if (typeof node === 'string') return prefix === '' ? [] : [prefix];
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return [];
  const keys = [];
  for (const [key, value] of Object.entries(node)) {
    keys.push(
      ...collectLeafKeys(value, prefix === '' ? key : `${prefix}.${key}`),
    );
  }
  return keys;
}

/** 收集**非字符串**叶子（数组/数字/布尔/null）——它们不被消息编译覆盖，需要如实报出。 */
export function collectNonStringLeaves(node, prefix = '') {
  if (typeof node === 'string') return [];
  if (node === null || typeof node !== 'object') {
    return prefix === '' ? [] : [prefix];
  }
  const keys = [];
  for (const [key, value] of Object.entries(node)) {
    keys.push(
      ...collectNonStringLeaves(value, prefix === '' ? key : `${prefix}.${key}`),
    );
  }
  return keys;
}

/**
 * 会被**原型污染**利用的键名：语言包是 JSON 数据，这三个名字没有任何合法用途。
 * `JSON.parse('{"__proto__":{...}}')` 会生成**自有**的 `__proto__` 键，随后
 * `target['__proto__'] = value` 会走原型链访问器 ⇒ 可能改写 `Object.prototype`。
 * CodeQL 的 `js/prototype-pollution-utility` 正是这条（本 PR 实测被报 #12 / medium）。
 */
const UNSAFE_MERGE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * **深合并**两个语言包对象（对齐 vue-i18n `mergeLocaleMessage` 的语义）。
 *
 * 为什么必须深合并（独立复核指出的低危残留）：生产的 `mergeLocaleMessage` 是**递归深合并**，
 * 而第一版门禁用的是命名空间级**浅合并**（`{...shared[ns], ...app[ns]}`）。
 * 今天两者结果相同（基座的 5 个命名空间 `authentication/common/preferences/profile/ui`
 * 与任何应用的文件名**零重叠**，复核独立比对确认 0 条盲区键）；但只要将来基座新增一个与某应用
 * **同名**的 json（例如给基座也加 `page.json`），浅合并就会让**该命名空间下同名子对象整块被替换**，
 * 被替换掉的键**编译不到** ⇒ 又变成「门禁绿、线上抛」。深合并从根上消掉这条路径。
 * 复核用真实 vue-i18n 做了 6 类情形（同名命名空间/同名叶子/三层嵌套/双向类型冲突/数组）对照，
 * 不一致用例数 = 0。
 *
 * 规则与 vue-i18n 一致：两边都是普通对象则递归合并，否则以 `source` 为准；数组**替换**而非拼接。
 *
 * 安全：跳过 `UNSAFE_MERGE_KEYS`，且读取 `target` 上已有值时只认**自有属性**
 * （`Object.hasOwn`）——两者共同消除原型污染路径（今天语言包里这三个键 0 命中，
 * 属「现在不可达、但写法本身是漏洞模式」）。
 */
export function deepMergeMessages(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (UNSAFE_MERGE_KEYS.has(key)) continue;
    // 只认自有属性：`{}` 的 `__proto__` 是原型上的访问器而非自有键 ⇒ 不会被当成可递归的对象
    const current = Object.hasOwn(target, key) ? target[key] : undefined;
    if (
      current &&
      value &&
      typeof current === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(current) &&
      !Array.isArray(value)
    ) {
      deepMergeMessages(current, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

/**
 * 读取一组目录（**按给定顺序合并，后者覆盖前者，深合并**）下某语言的全部语言包。
 * 命名空间 = 文件名（不含 .json）。
 */
export function loadDirsMessages(lang, dirs) {
  const messages = {};
  const files = [];
  const usedDirs = [];
  for (const base of dirs) {
    const dir = join(ROOT, base, lang);
    let entries;
    try {
      // `withFileTypes` 让「是不是普通文件」与目录项**来自同一次系统调用**。
      // 刻意不写成「先 `statSync` 判类型、再 `readFileSync` 读内容」：那是 TOCTOU
      // （检查与使用之间文件可能被换掉），CodeQL 会报 `js/file-system-race`（本 PR 实测被抓到）。
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    usedDirs.push(base);
    for (const entry of entries) {
      if (!entry.name.endsWith('.json')) continue;
      // 只收普通文件与符号链接。**注意语义**：`isSymbolicLink()` 不跟随链接，
      // 所以「指向普通文件的链接」会被收下（= 旧实现 `statSync().isFile()` 的效果），
      // 而「指向目录的链接」也会被收下 —— 因此下面的读取必须有 try/catch，
      // 否则 readFileSync 会以 EISDIR 把整个门禁崩掉（独立复核实测的语义回退，已修）。
      if (!entry.isFile() && !entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      const namespace = entry.name.replace(/\.json$/, '');

      let raw;
      try {
        raw = readFileSync(full, 'utf8');
      } catch (error) {
        // 断链 / 指向目录的符号链接 / 权限不可读：**告警并跳过**（与旧实现「非普通文件即跳过」等价），
        // 不让门禁自身崩掉。刻意用 try/catch 而不是再补一次 `statSync`——那会把
        // `js/file-system-race`（TOCTOU）告警带回来。
        console.warn(
          `[i18n-compile] 跳过不可读的语言包：${relative(ROOT, full)}` +
            `（${error?.code ?? error?.message}）`,
        );
        continue;
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        // JSON 坏了是**内容错误**，不能跳过：跳过等于整个语言包被门禁静默忽略
        //（那正是「0 违规可能是没跑到」，教训八）。
        throw new Error(
          `语言包不是合法 JSON：${relative(ROOT, full)}：${error.message}`,
        );
      }

      files.push(relative(ROOT, full));
      // **深合并**（不是 `{...a, ...b}` 浅合并）：与生产 `mergeLocaleMessage` 语义一致，
      // 否则同名命名空间下的同名子对象会被整块替换、被替换掉的键编译不到（见 deepMergeMessages）。
      messages[namespace] = deepMergeMessages(
        messages[namespace] ?? {},
        parsed,
      );
    }
  }
  return { files, messages, usedDirs };
}

/** 兼容旧用法：读「基座 + 某个应用目录」。 */
export function loadLangMessages(lang, dirs = [SHARED_LOCALE_DIR]) {
  return loadDirsMessages(lang, dirs);
}

/**
 * 按**生产口径**编译某语言：逐个应用（基座 → 应用自己的包，应用胜出）。
 *
 * @returns {{compiled:number, failures:Array<{app:string,key:string,reason:string}>,
 *            scannedFiles:string[], usedDirs:string[], skippedNonString:string[]}}
 */
export function compileLang(lang, { namespace } = {}) {
  const failures = [];
  const scannedFiles = new Set();
  const usedDirs = new Set();
  const skippedNonString = new Set();
  let compiled = 0;

  for (const bundle of APP_BUNDLES) {
    const dirs = [SHARED_LOCALE_DIR, ...bundle.dirs];
    const { files, messages, usedDirs: dirsHit } = loadDirsMessages(lang, dirs);
    for (const file of files) scannedFiles.add(file);
    for (const dir of dirsHit) usedDirs.add(dir);

    const global = createI18nFor(lang, messages);

    const keys = [];
    for (const [namespaceName, value] of Object.entries(messages)) {
      keys.push(...collectLeafKeys(value, namespaceName));
      for (const skipped of collectNonStringLeaves(value, namespaceName)) {
        skippedNonString.add(`${bundle.app}:${skipped}`);
      }
    }
    const scoped = namespace
      ? keys.filter(
          (key) => key === namespace || key.startsWith(`${namespace}.`),
        )
      : keys;

    compiled += scoped.length;
    for (const key of scoped) {
      try {
        global.t(key);
      } catch (error) {
        failures.push({
          app: bundle.app,
          key,
          reason: String(error?.message ?? error).split('\n')[0],
        });
      }
    }
  }

  // 同一基座键在每个应用里都会失败一次 ⇒ 按 (key, reason) 去重，并合出受影响应用列表，
  // 否则一个基座键坏了会刷 N 行（噪声会把真正的问题埋掉）。
  const merged = new Map();
  for (const failure of failures) {
    const id = `${failure.key}\u0000${failure.reason}`;
    const hit = merged.get(id);
    if (hit) {
      hit.apps.push(failure.app);
    } else {
      merged.set(id, {
        apps: [failure.app],
        key: failure.key,
        reason: failure.reason,
      });
    }
  }

  return {
    compiled,
    failures: [...merged.values()].map((item) => ({
      app: item.apps.join(','),
      apps: item.apps,
      key: item.key,
      reason: item.reason,
    })),
    scannedFiles: [...scannedFiles],
    usedDirs: [...usedDirs],
    skippedNonString: [...skippedNonString],
  };
}

/** 全库扫描（默认 zh-CN + en-US）。 */
export function scanAll({ languages = LANGS, namespace } = {}) {
  const failures = [];
  const scannedFiles = new Set();
  const skippedNonString = new Set();
  let compiled = 0;
  for (const lang of languages) {
    const result = compileLang(lang, { namespace });
    for (const file of result.scannedFiles) scannedFiles.add(file);
    for (const item of result.skippedNonString) skippedNonString.add(item);
    compiled += result.compiled;
    for (const failure of result.failures) {
      failures.push({ lang, ...failure });
    }
  }
  return {
    failures,
    compiled,
    scannedFiles: scannedFiles.size,
    skippedNonString: [...skippedNonString],
  };
}

function main(argv) {
  const json = argv.includes('--json');
  const namespaceIndex = argv.indexOf('--namespace');
  const namespace =
    namespaceIndex === -1 ? undefined : argv[namespaceIndex + 1];
  if (namespaceIndex !== -1 && !namespace) {
    console.error('[i18n-compile] --namespace 后必须跟一个前缀');
    process.exit(2);
  }

  const { failures, compiled, scannedFiles, skippedNonString } = scanAll({
    namespace,
  });
  const scope = namespace ? `（限定前缀 ${namespace}）` : '（全库）';

  // 空跑自检优先：扫不到文件、或编译条数低得离谱 ⇒ 是门禁坏了，不是代码干净。
  // 必须**先**判它，否则会出现「先报 OK、再报空跑」这种自相矛盾的输出。
  const floor = namespace ? 1 : MIN_COMPILED;
  const vacuous = scannedFiles === 0 || compiled < floor;

  if (json) {
    console.log(
      JSON.stringify(
        { compiled, failures, scannedFiles, skippedNonString, vacuous },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `[i18n-compile] ${LANGS.join(' + ')}${scope}：${APP_BUNDLES.length} 个应用 × 基座，` +
        `扫到 ${scannedFiles} 个语言包文件，编译 ${compiled} 条文案`,
    );
    if (skippedNonString.length > 0) {
      // 如实声明覆盖边界：这些叶子不参与消息编译（vue-i18n 对它们不走编译路径）。
      console.log(
        `[i18n-compile] 注意：${skippedNonString.length} 个非字符串叶子不参与编译检查：` +
          skippedNonString.slice(0, 10).join(', ') +
          (skippedNonString.length > 10 ? ' …' : ''),
      );
    }
    if (vacuous) {
      console.error(
        `[i18n-compile] 门禁空跑：scannedFiles=${scannedFiles} compiled=${compiled}（下限 ${floor}）` +
          '（教训八：0 违规可能是「没跑到」）',
      );
    } else if (failures.length > 0) {
      console.error(`[i18n-compile] ${failures.length} 条文案编译失败：`);
      for (const { lang, key, reason, app } of failures) {
        console.error(`  - [${lang}][${app}] ${key} → ${reason}`);
      }
    } else {
      console.log('[i18n-compile] OK：没有编译不过的文案');
    }
  }

  if (vacuous) process.exit(1);
  process.exit(failures.length > 0 ? 1 : 0);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2));
}
