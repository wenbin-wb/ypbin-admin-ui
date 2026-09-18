#!/usr/bin/env node
/**
 * 埋点事件码同步器（读**两份**：starter 的 base + 宿主后端的 project）。
 *
 * 事件目录是**两层**的（分层方案见 starter 的 `docs/MODULES.md` 与 `tools/export-tracking-events.mjs`）：
 *   - **base**：ypbin-starter 仓库的 `docs/tracking-events.json`（平台通用事件）；
 *   - **project**：宿主后端仓内 `META-INF/ypbin/tracking-events.json`（宿主自有业务事件，随宿主 jar 打包）。
 * 运行时由 starter 用 `classpath*:` 取回两份并按「同一事件码以 project 为准」合并；本脚本在**构建期**做同一件事，
 * 把联合结果派生为前端可直接引用的 TS 常量，避免在页面里手写事件码字符串造成前后端漂移。
 * 合并口径与运行时 `TrackingCatalogMerger` 对齐：`description`/属性名集合/属性 `type`/`maxLength`
 * （未声明即「不限制」，按 0 归一后比较）。
 *
 * 用法：
 *   node scripts/sync-tracking-events.mjs            # 生成 packages/tracking/src/events.generated.ts
 *   node scripts/sync-tracking-events.mjs --check    # 只校验生成物与两份事实源合并结果一致（CI 漂移门禁）
 *
 * 事实源位置（均可用环境变量覆盖，CI 里会把两个仓分别检出）：
 *   - base：`STARTER_REPO_ROOT`，默认同级 `../ypbin-starter`；
 *   - project：`HOST_REPO_ROOT`，默认同级 `../ypbin-admin`；也可用 `HOST_TRACKING_EVENTS` 直接指定文件。
 *     **向后兼容**：宿主仓未提供 project 目录时按「纯 base」生成（这正是分层的意义：starter 能被别的项目引用）；
 *     而本仓（admin-ui）的生成物含宿主事件，故 CI/本地都必须检出宿主仓，否则生成物少码、漂移门禁会如实报红。
 *
 * `--check` 退出码（**「找不到事实源」不等于「漂移」，两者必须能分辨**）：
 *   0 = 生成物与 base + project 合并结果一致；
 *   1 = 真漂移（生成物与事实源合并结果不同）；
 *   2 = 检出/配置/数据问题，比较基准不可信，**不能**下「事件码已漂移」的结论（那会把排查方向带偏）：
 *       base 或 project 层事件目录缺失/读不到/不是合法 JSON/**结构或类型不合法**（见下「生成前自检」）、
 *       schemaVersion 不支持、宿主仓内出现多份 project 层目录，或生成物声明含宿主事件却未找到宿主目录
 *       （`HOST_REPO_ROOT` 指向不存在的目录或不是目录即此列）。
 *       这类问题在比较之前就会失败——基准不完整时，漂移无从判定。
 *   契约边界：project 层目录只认「资源根下的 META-INF/ypbin/tracking-events.json」这一白名单位置
 *       （与运行时同口径，见 `findHostCatalog`）；宿主换到别的位置会被按「未找到」处理并退 2，属预期。
 *   即：**除真漂移（1）外，本脚本不以任何其它方式退出 1**（未捕获异常会让 Node 固定退 1，故异常一律收口）。
 *
 * 生成前自检（**核心：不让「非法数据」以退出码 0 产出非法 TS**）：
 *   本脚本在合并/渲染**之前**校验两层目录数据（`assertCatalogShape`，逐层执行），口径对照运行时
 *   `TrackingCatalogLoader`（它 base/project 两份资源各自校验）与 starter 侧 `validate()`：
 *     ① `events` 必须是**非空**数组——运行时对空目录直接启动失败（`has no events`），故空集合非法；
 *     ② **同一层内**事件码不得重复——运行时对同层重复码直接启动失败（`duplicated tracking event code`）；
 *        只有**跨层**同码才是合法的「覆盖」（打印 WARN），两者性质不同，不可混为一谈；
 *     ③ `description`（事件与属性）声明时必须为字符串：运行时绑定 `String`，且它是生成物里的字符串字面量；
 *        换行/回车/制表/U+2028/U+2029 等由 `quote()` **转义**后写入（不是拒绝）——运行时接受这些字符，
 *        故此处不比运行时更严；裸拼接才会产出语法非法的 TS；
 *     ④ `maxLength` 声明时必须是**正整数**：运行时绑定 `Integer`（非整数启动即失败），
 *        starter 侧 `validate()` 亦要求 string 属性声明正整数；
 *     ⑤ `type` 必须是运行时 `normalize()` 支持的四种之一（string/integer/number/boolean）——与 starter
 *        `validate()` 同口径；未知类型在运行时会让该属性的**所有取值被静默丢弃**；
 *     ⑥ 事件码必须能派生**合法且唯一**的 TS 常量名（生成器能力边界，见 `assertGeneratable`）。
 *   任一项不满足即退 2 并打印层名与元素序号（1 起算）；它们都是数据问题，不是漂移。
 *   ⚠ 生成物的语法合法性**不靠**「跑一遍 tsc」兜底（低配机代价过高）：字符串一律经 `quote()` 单趟转义，
 *   数字只接受已验证的整数，对象键按「必要时才加引号」输出——由构造保证合法。
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const starterRoot = process.env.STARTER_REPO_ROOT
  ? resolve(process.env.STARTER_REPO_ROOT)
  : resolve(repoRoot, '..', 'ypbin-starter');
const hostRoot = process.env.HOST_REPO_ROOT
  ? resolve(process.env.HOST_REPO_ROOT)
  : resolve(repoRoot, '..', 'ypbin-admin');
const sourceFile = join(starterRoot, 'docs', 'tracking-events.json');
const targetFile = join(
  repoRoot,
  'packages',
  'tracking',
  'src',
  'events.generated.ts',
);

/** 调用方是否**显式**指定了宿主仓根目录（显式指定即承诺「本该有宿主」） */
const hostRootExplicit = (process.env.HOST_REPO_ROOT ?? '') !== '';

/** 调用方是否**直接指定了宿主目录文件**（优先级高于 `HOST_REPO_ROOT`，见 `findHostCatalog`） */
const hostFileExplicit = (process.env.HOST_TRACKING_EVENTS ?? '') !== '';

/** project 层在宿主仓内的相对约定路径（与运行时 `TrackingEventCatalog.RESOURCE_PATH` 同值） */
const HOST_CATALOG_SUFFIX = join('META-INF', 'ypbin', 'tracking-events.json');

/**
 * 生成物头部「project 层事实源」的两行文案。
 *
 * **单点定义**：`render()` 用它输出，`--check` 也用它判定「已提交的生成物是否声明含宿主事件」——
 * 若在判定处再抄一份字面量，两处就会各自漂移，判定随之失准。
 */
const PROJECT_SOURCE_WITH_HOST =
  ' *   2) project —— 宿主后端仓（默认同级 `../ypbin-admin`）的 `META-INF/ypbin/tracking-events.json`（宿主自有业务事件）。';
const PROJECT_SOURCE_PURE_BASE =
  ' *   2) project —— 宿主后端仓的 project 层目录**本次未找到**，故生成物只含 base 事件（纯 base 宿主）。';

/**
 * 运行时支持的属性类型集合（口径来源：starter `TrackIngestService#normalize` 的 switch 分支，
 * 以及 starter 侧 `validate()` 的 `PROPERTY_TYPES`）。**不在集合内的类型不是「未知就放过」**：
 * 运行时 `normalize` 的 `default -> null` 会让该属性的所有取值被判为 typeMismatch 并静默丢弃。
 */
const PROPERTY_TYPES = new Set(['string', 'integer', 'number', 'boolean']);

/** 遍历宿主仓时跳过的目录（构建产物/依赖，纯性能考虑） */
const SKIPPED_DIRS = new Set([
  '.git',
  '.turbo',
  'dist',
  'node_modules',
  'target',
]);

const checkMode = process.argv.includes('--check');

/**
 * 在宿主仓内定位 project 层目录文件。
 *
 * **为什么不写死模块路径**：宿主是多模块仓，"哪个模块承载宿主目录"是宿主的自由（admin 当前放在
 * `ypbin-common/src/main/resources`，因为它要同时出现在 auth 与 system 的类路径上）。写死模块路径会让
 * 宿主换模块时本脚本静默失明；故改为递归查找，并按运行时同款规则处理多份：
 * 0 份 = 纯 base（宿主未使用分层能力），>1 份 = 直接报错（无法确定覆盖优先级，运行时同样是启动即失败）。
 *
 * @returns project 层文件路径；宿主未提供时返回 null
 */
function findHostCatalog() {
  const explicit = process.env.HOST_TRACKING_EVENTS;
  if (explicit) {
    const file = resolve(explicit);
    if (!existsSync(file)) {
      throw new Error(`HOST_TRACKING_EVENTS 指定的宿主事件目录不存在: ${file}`);
    }
    return file;
  }
  if (!existsSync(hostRoot)) {
    return null;
  }
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) {
          walk(path);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      // 只认「资源根/META-INF/ypbin/tracking-events.json」，避免把测试夹具或生成物误当事实源
      if (
        path.endsWith(join('src', 'main', 'resources', HOST_CATALOG_SUFFIX)) ||
        path.endsWith(join('resources', HOST_CATALOG_SUFFIX))
      ) {
        found.push(path);
      }
    }
  };
  walk(hostRoot);
  if (found.length > 1) {
    throw new Error(
      `宿主仓出现 ${found.length} 份 project 层事件目录，无法确定覆盖优先级（运行时同样会启动失败）：\n  - ${found.join('\n  - ')}`,
    );
  }
  return found.length === 1 ? found[0] : null;
}

/** 属性长度上限的归一化口径：目录只为 string 声明 maxLength，其余类型缺省即「不限制」（0） */
function normalizedMaxLength(property) {
  return property.maxLength ?? 0;
}

/**
 * 判断 project 侧定义相对 base 侧是否**确有字段变化**（口径与运行时 `TrackingCatalogMerger` 一致）。
 *
 * @returns 有变化返回 true
 */
function overridesBase(baseEvent, projectEvent) {
  if (baseEvent.description !== projectEvent.description) {
    return true;
  }
  const baseProperties = new Map(
    (baseEvent.properties ?? []).map((property) => [property.name, property]),
  );
  const projectProperties = new Map(
    (projectEvent.properties ?? []).map((property) => [
      property.name,
      property,
    ]),
  );
  if (baseProperties.size !== projectProperties.size) {
    return true;
  }
  for (const [name, property] of projectProperties) {
    const before = baseProperties.get(name);
    if (
      before === undefined ||
      before.type !== property.type ||
      normalizedMaxLength(before) !== normalizedMaxLength(property)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 合并 base 与 project：同一事件码**以 project 为准**，并给出被覆盖的事件码。
 *
 * **前置条件**：两层各自都**没有同层重复码**（由 `assertCatalogShape` 保证）。这里用 Map 承载合并结果，
 * 天然是「后者胜出」语义，但同层重复码已在更早一步被判为数据错误并以退出码 2 终止——所以本函数里
 * 出现的每一次覆盖都必然是**跨层**覆盖（base 被 project 覆盖），与打印的 WARN 措辞一致。
 *
 * @returns 联合目录（事件按码升序）与被覆盖事件码
 */
function mergeCatalogs(baseCatalog, projectCatalog) {
  const merged = new Map(
    baseCatalog.events.map((event) => [event.code, event]),
  );
  const overriddenCodes = [];
  const addedCodes = [];
  for (const event of projectCatalog.events) {
    const previous = merged.get(event.code);
    if (previous === undefined) {
      addedCodes.push(event.code);
    } else if (overridesBase(previous, event)) {
      overriddenCodes.push(event.code);
    }
    merged.set(event.code, event);
  }
  return {
    addedCodes,
    events: [...merged.keys()]
      .toSorted((a, b) => a.localeCompare(b))
      .map((code) => merged.get(code)),
    overriddenCodes: overriddenCodes.toSorted((a, b) => a.localeCompare(b)),
  };
}

/** 事件码 -> TS 常量名（大写下划线） */
function constantName(code) {
  return code.replaceAll('.', '_').replaceAll('-', '_').toUpperCase();
}

/** 单个反斜杠；`String.raw` 无法表达它——`` String.raw`\` `` 会把结束反引号一起转义掉，故用普通字面量 */
// oxlint-disable-next-line unicorn/prefer-string-raw -- 见上：String.raw 无法表达单个反斜杠
const BACKSLASH = '\\';

/** `\uXXXX` 形态的转义前缀（反斜杠 + u 两个字符） */
const UNICODE_ESCAPE_PREFIX = String.raw`\u`;

/** C0 控制字符的码点上界（含）与 DEL 的码点：这两类字符无法直接出现在字符串字面量里 */
const LAST_C0_CODE_POINT = 31;
const DELETE_CODE_POINT = 127;

/**
 * 单引号字符串字面量的转义表：字符 → 它在字面量里的转义序列（值本身即「反斜杠 + 字符」两个字符）。
 *
 * 覆盖「不能出现在单引号字符串字面量里」的全部字符：反斜杠、单引号、行终止符（\n \r 与 U+2028/U+2029）；
 * 其余 C0 控制字符与 DEL 由 `quote()` 走 \uXXXX 兜底。**单趟按码点映射**，故不存在
 * 「先替换 A 再把 A 的转义序列二次转义」的次序陷阱（旧实现按 `\\` → `'` 顺序链式 replaceAll，漏掉了换行，
 * 于是含换行的 description 会写出裸换行、生成物成为语法非法的 TS，而 `--check` 只比对文本、照样退 0）。
 */
const STRING_ESCAPES = new Map([
  [BACKSLASH, String.raw`\\`],
  ["'", String.raw`\'`],
  ['\n', String.raw`\n`],
  ['\r', String.raw`\r`],
  ['\u2028', String.raw`\u2028`],
  ['\u2029', String.raw`\u2029`],
]);

/**
 * 转义单引号字符串。
 *
 * 目的只有一个：**无论输入是什么字符串，输出都是合法的 TS 字符串字面量**（不做数据合法性判断，
 * 那属于 `assertCatalogShape` 的职责；两层分工＝「数据是否合法」与「文本是否可序列化」）。
 * 按码点遍历而不是用正则替换：既不触发 `no-control-regex`，也不会把一个码点拆成两个代理码元。
 */
function quote(text) {
  const escaped = [...String(text)].map((character) => {
    const mapped = STRING_ESCAPES.get(character);
    if (mapped !== undefined) {
      return mapped;
    }
    const codePoint = character.codePointAt(0);
    // C0 控制字符与 DEL 无法直接出现在字面量里（其余字符按原样输出）
    return codePoint <= LAST_C0_CODE_POINT || codePoint === DELETE_CODE_POINT
      ? `${UNICODE_ESCAPE_PREFIX}${codePoint.toString(16).padStart(4, '0')}`
      : character;
  });
  return `'${escaped.join('')}'`;
}

/**
 * 对象字面量的键：是合法标识符就裸写（保持与 oxfmt 的 `quoteProps: as-needed` 一致，否则漂移门禁会长期误报），
 * 否则退化为带引号的字符串键。
 *
 * 属性名在运行时没有格式约束（只做 JSON 键匹配），所以这里**刻意不校验** a-zA-Z0-9 之外的名字，
 * 而是让它安全地输出——比"直接拒绝"更贴近运行时契约，同时保证生成物语法合法。
 */
function propertyKey(name) {
  return /^[A-Z_$][\w$]*$/i.test(name) ? name : quote(name);
}

/** 按属性名排序的事件属性列表（事实源里的顺序不作契约） */
function sortedProperties(event) {
  return (event.properties ?? []).toSorted((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/**
 * 渲染事件目录条目（`TRACKING_EVENT_CATALOG` 的字面量部分）。
 *
 * 每个对象都**逐属性换行**输出：oxfmt 的 `objectWrap` 语义是「原文本已换行则保持换行」，
 * 若这里输出单行紧凑形式，格式化后会被改写成分行形式，漂移门禁就会长期误报。
 *
 * @param events          联合目录（按码升序）
 * @param overriddenCodes 被宿主 project 层覆盖的事件码；命中者在条目上方输出可见标注
 */
function renderCatalogEntries(events, overriddenCodes) {
  return events
    .map((event) => {
      const header = [
        `    code: ${quote(event.code)},`,
        `    description: ${quote(event.description ?? '')},`,
        `    source: ${quote(event.source ?? '')},`,
        `    since: ${quote(event.since ?? '')},`,
      ];
      const properties = sortedProperties(event).map((property) => {
        const fields = [
          `        name: ${quote(property.name)},`,
          `        type: ${quote(property.type ?? '')},`,
        ];
        // maxLength 只对字符串有意义，事实源对数值型属性刻意不声明，此时整体省略（表示"不截断"）。
        // 裸插值在这里是安全的：assertCatalogShape / assertGeneratable 已保证它只可能是正整数。
        if (property.maxLength !== undefined && property.maxLength !== null) {
          fields.push(`        maxLength: ${property.maxLength},`);
        }
        // required 同样按「声明才输出」处理：事实源当前**没有**这个字段，
        // 输出 false 会把"未声明"误读成"非必填"，故省略并交给类型上的可选语义表达
        if (property.required !== undefined) {
          fields.push(`        required: ${property.required === true},`);
        }
        fields.push(
          `        description: ${quote(property.description ?? '')},`,
        );
        return `      {\n${fields.join('\n')}\n      },`;
      });
      const body = [...header];
      body.push(
        properties.length > 0
          ? `    properties: [\n${properties.join('\n')}\n    ],`
          : '    properties: [],',
      );
      // 被 project 覆盖的码必须**在生成物里可见**（分层方案对"覆盖"的审计要求）；
      // 无覆盖时一行都不输出，避免生成物出现空噪音
      const marker = overriddenCodes.has(event.code)
        ? '  // ⚠️ 本事件码被宿主 project 层覆盖：以下定义以 project 为准，starter base 的定义已失效\n'
        : '';
      return `${marker}  ${quote(event.code)}: {\n${body.join('\n')}\n  },`;
    })
    .join('\n');
}

/**
 * 渲染生成物。
 *
 * @param merge   合并结果（联合目录 + 被覆盖的事件码）
 * @param hasHost 是否找到宿主 project 层目录（决定头部是否声明「只含 base」）
 */
function render(merge, hasHost) {
  const events = merge.events;
  const constants = events
    .map((event) => `  ${constantName(event.code)}: ${quote(event.code)},`)
    .join('\n');
  const properties = events
    .map((event) => {
      const entries = sortedProperties(event)
        .map(
          (property) =>
            `${propertyKey(property.name)}: ${property.maxLength ?? 0}`,
        )
        .join(', ');
      // 无属性的事件必须输出 `{}`；写成 `{  }` 会被 oxfmt 归一，导致漂移门禁长期误报
      return `  ${quote(event.code)}: ${entries ? `{ ${entries} }` : '{}'},`;
    })
    .join('\n');
  const catalogEntries = renderCatalogEntries(
    events,
    new Set(merge.overriddenCodes),
  );
  // 头部只写"逻辑来源"，**绝不写绝对路径**——否则本地与 CI 的检出路径不同会让漂移门禁长期误报
  const projectLine = hasHost
    ? PROJECT_SOURCE_WITH_HOST
    : PROJECT_SOURCE_PURE_BASE;

  return `/**
 * 埋点事件码与属性白名单（生成物，请勿手工修改）。
 *
 * 事实源：**base + project 两层合并**
 *   1) base —— ypbin-starter 仓库的 \`docs/tracking-events.json\`（平台通用事件）；
${projectLine}
 * 同一事件码以 project 为准；运行时由 starter 用 \`classpath*:\` 读两份并按同一规则合并
 * （口径见 starter 的 \`docs/MODULES.md\`）。修改事件目录请改对应层的文件，然后重跑本脚本，
 * 否则 CI 的「校验埋点事件码未漂移」会失败。
 * 生成器：本仓库 \`scripts/sync-tracking-events.mjs\`。
 */

/** 事件码常量：页面里禁止手写事件码字符串 */
export const TrackingEventCodes = {
${constants}
} as const;

/** 已登记的事件码联合类型 */
export type TrackingEventCode =
  (typeof TrackingEventCodes)[keyof typeof TrackingEventCodes];

/**
 * 事件码到属性白名单的映射：属性名 -> 最大字符长度（非字符串或未声明为 0，表示不限制）。
 *
 * SDK 据此在发送前裁剪 payload——不在白名单内的键一律不发，避免服务端逐条拒绝。
 */
export const TRACKING_EVENT_PROPERTIES: Record<
  string,
  Record<string, number>
> = {
${properties}
};

/**
 * 事件目录里的单个属性（白名单条目）。
 *
 * 与 {@link TRACKING_EVENT_PROPERTIES} 的区别：后者只服务于 SDK 的发送前裁剪，
 * 本类型保留类型/必填/描述等展示信息，供管理端只读展示与排障使用。
 */
export interface TrackingEventProperty {
  /** 属性名（上报 payload 的键，与后端同名） */
  name: string;
  /** 属性类型（事实源声明的类型名，如 string / integer / number） */
  type: string;
  /** 字符串最大长度；事实源未声明即省略，表示不在前端截断 */
  maxLength?: number;
  /** 是否必填；事实源未声明即省略——省略代表"目录未声明"，不等于"非必填" */
  required?: boolean;
  /** 属性说明 */
  description: string;
}

/** 事件目录条目 */
export interface TrackingEventCatalogItem {
  /** 事件码 */
  code: string;
  /** 事件说明（取自事实源，中文） */
  description: string;
  /** 事件来源：web / backend / iot */
  source: string;
  /** 引入版本 */
  since: string;
  /** 属性白名单（按属性名升序） */
  properties: TrackingEventProperty[];
}

/**
 * 事件目录：事件码 -> 元数据（描述、来源、引入版本与属性白名单明细）。
 *
 * 面向"事件目录"这类只读展示，以及用**动态事件码**（如列表行）反查人话描述的场合。
 * 键按事件码升序排列，遍历 {@link Object.values} 即得到有序列表。
 */
export type TrackingEventCatalog = Record<string, TrackingEventCatalogItem>;

export const TRACKING_EVENT_CATALOG: TrackingEventCatalog = {
${catalogEntries}
};
`;
}

async function readIfExists(file) {
  if (!existsSync(file)) {
    return null;
  }
  return readFile(file, 'utf8');
}

/**
 * 校验事件目录的**结构与类型**（只保证后续合并/渲染不会崩、生成物可序列化，不重复事实源所在仓的语义校验）。
 *
 * 为什么必须做：本脚本对 project 层（宿主仓）**没有上游兜底**——admin 仓没有任何构建期校验该文件，
 * 只要 JSON 结构被改坏（`events` 不是数组/为空、元素为 null、`code` 不是字符串、`description` 不是字符串、
 * `maxLength` 不是正整数），后续 merge/render 就会抛异常或**写出语法非法的 TS**，而 Node 对未捕获异常
 * 固定退 1 / `--check` 只比对文本，等于把「数据问题」报成「事件码已漂移」或干脆**假绿**。
 * 口径**逐条对照运行时**（见文件头「生成前自检」）：空 `events`、同层重复码、`description` 非字符串、
 * `maxLength` 非正整数、`type` 不在运行时支持集内——运行时分别表现为启动失败或静默丢弃，无一比运行时更严。
 * 事件码格式 / source / since 等**语义**校验仍归事实源所在仓（starter 的
 * `tools/export-tracking-events.mjs` 有 `validate()`），此处不做，避免宿主合法用法被误拦。
 *
 * @param catalog 已解析的目录对象
 * @param layer   层名（base / project），仅用于报错措辞
 */
function assertCatalogShape(catalog, layer) {
  const fail = (reason) => {
    console.error(
      `✖ 配置/数据问题（不是事件码漂移）：${layer} 层事件目录结构不合法——${reason}`,
    );
    process.exit(2);
  };
  if (
    catalog === null ||
    typeof catalog !== 'object' ||
    Array.isArray(catalog)
  ) {
    fail('顶层必须是 JSON 对象');
  }
  if (catalog.schemaVersion !== 1) {
    fail(`不支持的 schemaVersion：${catalog.schemaVersion}`);
  }
  if (!Array.isArray(catalog.events)) {
    fail('events 必须是数组');
  }
  // 空目录不是「没事件」而是**非法**：运行时 TrackingCatalogLoader 对 base/project 任一份空目录都直接
  // 抛 `tracking event catalog has no events`（启动即失败），故这里必须与运行时同判，而不是生成一份空映射。
  if (catalog.events.length === 0) {
    fail(
      'events 不能为空数组（运行时对空目录直接启动失败：tracking event catalog has no events）',
    );
  }
  const seenCodes = new Map();
  catalog.events.forEach((event, index) => {
    const position = `第 ${index + 1} 条`;
    if (
      event === null ||
      typeof event !== 'object' ||
      typeof event.code !== 'string'
    ) {
      fail(`${position}事件必须是含字符串 code 的对象`);
    }
    // 同层重复码是**数据错误**，不是「后者胜出」更不是「覆盖」：运行时会在载入期直接抛
    // `duplicated tracking event code`（TrackingCatalogLoader#read），故此处同样判非法，
    // 并指出重复的码与两个位置，便于直接定位。
    const firstIndex = seenCodes.get(event.code);
    if (firstIndex !== undefined) {
      fail(
        `第 ${firstIndex + 1} 条与${position}出现重复事件码 ${event.code}` +
          '（同层重复属数据错误；运行时同样启动失败。跨层同码才是合法的「覆盖」，会打印 WARN）',
      );
    }
    seenCodes.set(event.code, index);
    if (
      event.description !== undefined &&
      event.description !== null &&
      typeof event.description !== 'string'
    ) {
      fail(
        `${position}事件 ${event.code} 的 description 必须是字符串（运行时绑定 String）`,
      );
    }
    const properties = event.properties ?? [];
    if (!Array.isArray(properties)) {
      fail(`事件 ${event.code} 的 properties 必须是数组`);
    }
    properties.forEach((property, propertyIndex) => {
      const propertyPosition = `事件 ${event.code} 的第 ${propertyIndex + 1} 个属性`;
      if (
        property === null ||
        typeof property !== 'object' ||
        typeof property.name !== 'string'
      ) {
        fail(`${propertyPosition}必须是含字符串 name 的对象`);
      }
      if (property.type !== undefined && !PROPERTY_TYPES.has(property.type)) {
        fail(
          `${propertyPosition} ${property.name} 的 type 非法：${JSON.stringify(property.type)}` +
            `（运行时仅支持 ${[...PROPERTY_TYPES].join('/')}；未知类型会让该属性的所有取值被静默丢弃）`,
        );
      }
      if (
        property.maxLength !== undefined &&
        property.maxLength !== null &&
        !(Number.isInteger(property.maxLength) && property.maxLength > 0)
      ) {
        fail(
          `${propertyPosition} ${property.name} 的 maxLength 必须是正整数，当前为 ` +
            `${JSON.stringify(property.maxLength)}（运行时绑定 Integer，非整数启动即失败；` +
            'starter 侧 validate() 亦要求 string 属性声明正整数）',
        );
      }
      if (
        property.description !== undefined &&
        property.description !== null &&
        typeof property.description !== 'string'
      ) {
        fail(
          `${propertyPosition} ${property.name} 的 description 必须是字符串（运行时绑定 String）`,
        );
      }
    });
  });
}

/**
 * 渲染前自检：保证「即将写出的文本」在语法上一定合法。
 *
 * 与 `assertCatalogShape` 的分工：后者判「数据是否符合运行时契约」（逐层、含位置信息），本函数判
 * 「数据能否被**无歧义地**序列化成 TS」（合并后、只看生成物语义）。两处都失败退 2——把生成器自身的
 * 能力边界说清楚，而不是产出一份语法非法的文件再让下游 `typecheck` 去发现。
 *
 * ① 事件码 → TS 常量名（`TrackingEventCodes` 的对象键）必须是合法标识符且互不相同：
 *    事件码在运行时只当字符串用，因此 `ui.page.view!` 这类码在运行时**合法**，但它会派生出带 `!` 的对象键，
 *    生成物直接语法非法；`a.b-c` 与 `a.b.c` 又会派生出同名键（TS 报重复属性）。这两类只能在此拦下。
 * ② `maxLength` 再断言一次正整数：`assertCatalogShape` 已保证，这里防的是「未来有人绕开校验直接调 render」，
 *    以及把「裸插值一个非数字」这类回归挡在生成物之外。
 *
 * @param events 合并后的联合目录（按码升序）
 */
function assertGeneratable(events) {
  const fail = (reason) => {
    console.error(
      `✖ 配置/数据问题（不是事件码漂移）：生成物自检失败——${reason}`,
    );
    process.exit(2);
  };
  const nameOwners = new Map();
  for (const event of events) {
    const name = constantName(event.code);
    if (!/^[A-Z_$][\dA-Z_$]*$/.test(name)) {
      fail(
        `事件码 ${JSON.stringify(event.code)} 无法派生合法的 TS 常量名（得到 ${JSON.stringify(name)}）；` +
          '事件码只能含字母、数字、下划线、点、连字符',
      );
    }
    const owner = nameOwners.get(name);
    if (owner !== undefined) {
      fail(
        `事件码 ${JSON.stringify(event.code)} 与 ${JSON.stringify(owner)} 派生出的 TS 常量名相同（${name}），` +
          '会在生成物里产生重复对象键',
      );
    }
    nameOwners.set(name, event.code);
    for (const property of event.properties ?? []) {
      if (
        property.maxLength !== undefined &&
        property.maxLength !== null &&
        !(Number.isInteger(property.maxLength) && property.maxLength > 0)
      ) {
        fail(
          `事件 ${event.code} 属性 ${property.name} 的 maxLength 必须是正整数（当前 ${JSON.stringify(property.maxLength)}）`,
        );
      }
    }
  }
}

/**
 * 读取并解析一层事件目录，并做结构校验。
 *
 * 事实源**读不到**或**不是合法 JSON** 属配置/数据问题，与「事件码漂移」性质不同：
 * 未捕获的 `SyntaxError` 会让 Node 以退出码 1 结束，等于又把配置问题报成了漂移，故统一收口到 2。
 *
 * @param file  事件目录文件
 * @param layer 层名（base / project），仅用于报错措辞
 */
async function readCatalog(file, layer) {
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    console.error(
      `✖ 配置/检出问题（不是事件码漂移）：${layer} 层事件目录读不到：${file}`,
    );
    console.error(`  ${error.message}`);
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(
      `✖ 配置/数据问题（不是事件码漂移）：${layer} 层事件目录不是合法 JSON：${file}`,
    );
    console.error(`  ${error.message}`);
    process.exit(2);
  }
  assertCatalogShape(parsed, layer);
  return parsed;
}

if (!existsSync(sourceFile)) {
  console.error(
    `✖ 配置/检出问题（不是事件码漂移）：找不到 base 层事件目录：${sourceFile}`,
  );
  console.error(
    '  请设置 STARTER_REPO_ROOT 指向 ypbin-starter 仓库根目录（该目录缺失属检出问题，不是事件码漂移）。',
  );
  process.exit(2);
}

const baseCatalog = await readCatalog(sourceFile, 'base');

// project 层是可选的：找不到即「纯 base 宿主」（向后兼容），多份则直接报错（不按不可靠顺序择一）
//
// ⚠ 但「显式给了 HOST_REPO_ROOT、该目录却不存在」不属于「宿主只读 base」，而是检出/配置问题：
// 若继续按纯 base 生成/比对，就会把配置错误报成「事件码已漂移」，把排查方向带偏（本仓 CI 真踩过）。
// 故当场失败并用独立退出码 2 表明性质，既不生成也不比对。
// 注意必须让位于 `HOST_TRACKING_EVENTS`：那是「直接指定宿主目录文件」的更高优先级入口，
// 与 HOST_REPO_ROOT 同时存在时不该因为后者失效而失败（否则会无端压掉一条既有用法）。
// 判据用「确实是目录」而非仅「存在」：指向一个普通文件同样属配置问题，且会让后续递归遍历抛 ENOTDIR。
const hostRootIsDirectory =
  existsSync(hostRoot) && statSync(hostRoot).isDirectory();
if (hostRootExplicit && !hostFileExplicit && !hostRootIsDirectory) {
  console.error(
    `✖ 配置/检出问题（不是事件码漂移）：HOST_REPO_ROOT ${
      existsSync(hostRoot) ? '不是一个目录' : '指向的宿主仓目录不存在'
    }：${hostRoot}`,
  );
  console.error(
    '  请核对宿主仓是否已检出、路径是否正确；若宿主确实只读 base，请去掉 HOST_REPO_ROOT。',
  );
  process.exit(2);
}
// findHostCatalog 内部还有两类失败（HOST_TRACKING_EVENTS 指的文件不存在、宿主仓内出现多份 project 层目录）：
// 它们同样是配置/数据问题，但原先以未捕获异常冒泡——Node 对未捕获异常固定退 1，等于又落回「漂移码」，
// 与上面刚建立的契约自相矛盾。故一并收口到 2。
let hostCatalogFile;
try {
  hostCatalogFile = findHostCatalog();
} catch (error) {
  console.error(`✖ 配置/检出/数据问题（不是事件码漂移）：${error.message}`);
  process.exit(2);
}
const projectCatalog =
  hostCatalogFile === null
    ? { events: [], schemaVersion: baseCatalog.schemaVersion }
    : await readCatalog(hostCatalogFile, 'project');

const merge = mergeCatalogs(baseCatalog, projectCatalog);
// 渲染前自检：把「数据非法/无法序列化」挡在生成物之外（详见 assertGeneratable 与文件头）
assertGeneratable(merge.events);
const content = render(merge, hostCatalogFile !== null);

// 覆盖是本方案唯一有意偏离「禁静默降级」的取舍：必须让人看见，故一律 print（走 stderr，不污染 CI 的 stdout）
for (const code of merge.overriddenCodes) {
  console.error(
    `⚠ 事件码 ${code} 被宿主 project 层覆盖（以 project 为准，base 定义已失效）`,
  );
}
for (const code of merge.addedCodes.toSorted((a, b) => a.localeCompare(b))) {
  console.error(`+ 宿主 project 层新增事件码：${code}`);
}
console.error(
  hostCatalogFile === null
    ? `  合并结果：base=${baseCatalog.events.length} project=0（宿主未提供 project 层） 合计=${merge.events.length}`
    : `  合并结果：base=${baseCatalog.events.length} project=${projectCatalog.events.length} ` +
        `新增=${merge.addedCodes.length} 覆盖=${merge.overriddenCodes.length} 合计=${merge.events.length}`,
);

if (checkMode) {
  // 读生成物同样可能失败（路径被占用成目录等）：这是环境问题而非漂移，收口到 2
  let current;
  try {
    current = await readIfExists(targetFile);
  } catch (error) {
    console.error(
      `✖ 配置/环境问题（不是事件码漂移）：读不到已提交的生成物 ${targetFile.slice(repoRoot.length + 1)}：${error.message}`,
    );
    process.exit(2);
  }
  if (current !== content) {
    // 「未找到宿主目录」有两种性质完全不同的原因，必须分开下结论：
    //   ① 已提交的生成物**声明含宿主事件** ⇒ 本该有宿主目录却没找到，是检出/配置问题：
    //      比较基准本身不完整，此时说「事件码已漂移」是**错误结论**（会把排查带偏）；
    //   ② 生成物本就是纯 base（宿主未使用分层能力）⇒ 找不到属正常，此时的差异才是真漂移。
    const artifactDeclaresHost = (current ?? '').includes(
      PROJECT_SOURCE_WITH_HOST,
    );
    if (hostCatalogFile === null && artifactDeclaresHost) {
      console.error(
        '✖ 配置/检出问题（不是事件码漂移）：生成物声明含宿主 project 层事件，但本次未找到宿主目录，比较基准不完整。',
      );
      console.error(
        `  - 宿主仓根目录：${hostRoot}${
          existsSync(hostRoot)
            ? '（目录存在，但其中没有 META-INF/ypbin/tracking-events.json）'
            : '（目录不存在）'
        }`,
      );
      console.error(
        '  请核对：① 宿主仓是否已检出；② HOST_REPO_ROOT 是否指向宿主仓根目录；③ 宿主仓检出到的分支是否已含该目录。',
      );
      process.exit(2);
    }
    console.error('✖ 前端事件码与 base + project 合并结果不一致（已漂移）：');
    console.error(`  - ${targetFile.slice(repoRoot.length + 1)}`);
    console.error('  修复：node scripts/sync-tracking-events.mjs');
    process.exit(1);
  }
  console.log(
    `✓ 前端事件码与 base + project 合并结果一致（${merge.events.length} 个事件）`,
  );
} else {
  try {
    await writeFile(targetFile, content, 'utf8');
  } catch (error) {
    console.error(
      `✖ 配置/环境问题（不是事件码漂移）：写入生成物失败 ${targetFile.slice(repoRoot.length + 1)}：${error.message}`,
    );
    process.exit(2);
  }
  console.log(
    `✓ 已生成前端事件码：${targetFile.slice(repoRoot.length + 1)}（${merge.events.length} 个事件）`,
  );
}
