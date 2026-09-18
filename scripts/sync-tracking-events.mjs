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
 */
import { existsSync, readdirSync } from 'node:fs';
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

/** project 层在宿主仓内的相对约定路径（与运行时 `TrackingEventCatalog.RESOURCE_PATH` 同值） */
const HOST_CATALOG_SUFFIX = join('META-INF', 'ypbin', 'tracking-events.json');

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

/**
 * 转义单引号字符串。
 *
 * 这里必须写转义序列：`String.raw` 无法表达单个反斜杠——`` String.raw`\` `` 会把结束反引号一起转义掉，
 * 直接变成未终止的模板串，故对 unicorn/prefer-string-raw 做逐行豁免。
 */
function quote(text) {
  // oxlint-disable-next-line unicorn/prefer-string-raw -- 单个反斜杠无法用 String.raw 表达
  return `'${String(text).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
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
        // maxLength 只对字符串有意义，事实源对数值型属性刻意不声明，此时整体省略（表示"不截断"）
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
        .map((property) => `${property.name}: ${property.maxLength ?? 0}`)
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
    ? ' *   2) project —— 宿主后端仓（默认同级 `../ypbin-admin`）的 `META-INF/ypbin/tracking-events.json`（宿主自有业务事件）。'
    : ' *   2) project —— 宿主后端仓的 project 层目录**本次未找到**，故生成物只含 base 事件（纯 base 宿主）。';

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

if (!existsSync(sourceFile)) {
  console.error(`✖ 找不到 base 层事件目录：${sourceFile}`);
  console.error('  请设置 STARTER_REPO_ROOT 指向 ypbin-starter 仓库根目录。');
  process.exit(1);
}

const baseCatalog = JSON.parse(await readFile(sourceFile, 'utf8'));
if (baseCatalog.schemaVersion !== 1) {
  console.error(
    `✖ 不支持的 base 层事件目录 schemaVersion：${baseCatalog.schemaVersion}`,
  );
  process.exit(1);
}

// project 层是可选的：找不到即「纯 base 宿主」（向后兼容），多份则直接报错（不按不可靠顺序择一）
const hostCatalogFile = findHostCatalog();
const projectCatalog =
  hostCatalogFile === null
    ? { events: [], schemaVersion: baseCatalog.schemaVersion }
    : JSON.parse(await readFile(hostCatalogFile, 'utf8'));
if (projectCatalog.schemaVersion !== 1) {
  console.error(
    `✖ 不支持的 project 层事件目录 schemaVersion：${projectCatalog.schemaVersion}`,
  );
  process.exit(1);
}

const merge = mergeCatalogs(baseCatalog, projectCatalog);
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
  const current = await readIfExists(targetFile);
  if (current !== content) {
    console.error('✖ 前端事件码与 base + project 合并结果不一致（已漂移）：');
    console.error(`  - ${targetFile.slice(repoRoot.length + 1)}`);
    console.error('  修复：node scripts/sync-tracking-events.mjs');
    if (hostCatalogFile === null) {
      console.error(
        '  ⚠ 本次未找到宿主 project 层目录：若本仓生成物含宿主事件，请检出宿主仓或设置 HOST_REPO_ROOT。',
      );
    }
    process.exit(1);
  }
  console.log(
    `✓ 前端事件码与 base + project 合并结果一致（${merge.events.length} 个事件）`,
  );
} else {
  await writeFile(targetFile, content, 'utf8');
  console.log(
    `✓ 已生成前端事件码：${targetFile.slice(repoRoot.length + 1)}（${merge.events.length} 个事件）`,
  );
}
