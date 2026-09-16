#!/usr/bin/env node
/**
 * 埋点事件码同步器。
 *
 * 事实源是 **ypbin-starter 仓库的 `docs/tracking-events.json`**（唯一事实源，见 starter 的
 * `tools/export-tracking-events.mjs`）。本脚本把它派生为前端可直接引用的 TS 常量，
 * 避免在页面里手写事件码字符串造成前后端漂移。
 *
 * 用法：
 *   node scripts/sync-tracking-events.mjs            # 生成 packages/tracking/src/events.generated.ts
 *   node scripts/sync-tracking-events.mjs --check    # 只校验生成物与事实源一致（CI 漂移门禁）
 *
 * 事实源位置：默认取同级的 `../ypbin-starter`，可用环境变量 `STARTER_REPO_ROOT` 覆盖
 * （CI 里会单独检出 starter 仓库）。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const starterRoot = process.env.STARTER_REPO_ROOT
  ? resolve(process.env.STARTER_REPO_ROOT)
  : resolve(repoRoot, '..', 'ypbin-starter');
const sourceFile = join(starterRoot, 'docs', 'tracking-events.json');
const targetFile = join(
  repoRoot,
  'packages',
  'tracking',
  'src',
  'events.generated.ts',
);

const checkMode = process.argv.includes('--check');

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
 */
function renderCatalogEntries(events) {
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
      return `  ${quote(event.code)}: {\n${body.join('\n')}\n  },`;
    })
    .join('\n');
}

function render(catalog) {
  const events = catalog.events.toSorted((a, b) =>
    a.code.localeCompare(b.code),
  );
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
  const catalogEntries = renderCatalogEntries(events);

  return `/**
 * 埋点事件码与属性白名单（生成物，请勿手工修改）。
 *
 * 事实源：ypbin-starter 仓库的 \`docs/tracking-events.json\`；
 * 生成器：本仓库 \`scripts/sync-tracking-events.mjs\`。
 * 修改事件目录请到 starter 仓库改事实源，然后重跑本脚本，否则 CI 的漂移门禁会失败。
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
  console.error(`✖ 找不到事件目录事实源：${sourceFile}`);
  console.error('  请设置 STARTER_REPO_ROOT 指向 ypbin-starter 仓库根目录。');
  process.exit(1);
}

const catalog = JSON.parse(await readFile(sourceFile, 'utf8'));
if (catalog.schemaVersion !== 1) {
  console.error(`✖ 不支持的事件目录 schemaVersion：${catalog.schemaVersion}`);
  process.exit(1);
}

const content = render(catalog);

if (checkMode) {
  const current = await readIfExists(targetFile);
  if (current !== content) {
    console.error('✖ 前端事件码与 starter 事件目录不一致（已漂移）：');
    console.error(`  - ${targetFile.slice(repoRoot.length + 1)}`);
    console.error('  修复：node scripts/sync-tracking-events.mjs');
    process.exit(1);
  }
  console.log(
    `✓ 前端事件码与 starter 事件目录一致（${catalog.events.length} 个事件）`,
  );
} else {
  await writeFile(targetFile, content, 'utf8');
  console.log(
    `✓ 已生成前端事件码：${targetFile.slice(repoRoot.length + 1)}（${catalog.events.length} 个事件）`,
  );
}
