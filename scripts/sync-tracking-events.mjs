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
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const starterRoot = process.env.STARTER_REPO_ROOT
  ? resolve(process.env.STARTER_REPO_ROOT)
  : resolve(repoRoot, '..', 'ypbin-starter')
const sourceFile = join(starterRoot, 'docs', 'tracking-events.json')
const targetFile = join(repoRoot, 'packages', 'tracking', 'src', 'events.generated.ts')

const checkMode = process.argv.includes('--check')

/** 事件码 -> TS 常量名（大写下划线） */
function constantName(code) {
  return code.replaceAll('.', '_').replaceAll('-', '_').toUpperCase()
}

/** 转义单引号字符串 */
function quote(text) {
  return `'${String(text).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

function render(catalog) {
  const events = [...catalog.events].sort((a, b) => a.code.localeCompare(b.code))
  const constants = events
    .map((event) => `  ${constantName(event.code)}: ${quote(event.code)},`)
    .join('\n')
  const properties = events
    .map((event) => {
      const entries = [...(event.properties ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((property) => `${property.name}: ${property.maxLength ?? 0}`)
        .join(', ')
      // 无属性的事件必须输出 `{}`；写成 `{  }` 会被 oxfmt 归一，导致漂移门禁长期误报
      return `  ${quote(event.code)}: ${entries ? `{ ${entries} }` : '{}'},`
    })
    .join('\n')

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
`
}

async function readIfExists(file) {
  if (!existsSync(file)) {
    return null
  }
  return readFile(file, 'utf8')
}

if (!existsSync(sourceFile)) {
  console.error(`✖ 找不到事件目录事实源：${sourceFile}`)
  console.error('  请设置 STARTER_REPO_ROOT 指向 ypbin-starter 仓库根目录。')
  process.exit(1)
}

const catalog = JSON.parse(await readFile(sourceFile, 'utf8'))
if (catalog.schemaVersion !== 1) {
  console.error(`✖ 不支持的事件目录 schemaVersion：${catalog.schemaVersion}`)
  process.exit(1)
}

const content = render(catalog)

if (checkMode) {
  const current = await readIfExists(targetFile)
  if (current !== content) {
    console.error('✖ 前端事件码与 starter 事件目录不一致（已漂移）：')
    console.error(`  - ${targetFile.slice(repoRoot.length + 1)}`)
    console.error('  修复：node scripts/sync-tracking-events.mjs')
    process.exit(1)
  }
  console.log(`✓ 前端事件码与 starter 事件目录一致（${catalog.events.length} 个事件）`)
} else {
  await writeFile(targetFile, content, 'utf8')
  console.log(
    `✓ 已生成前端事件码：${targetFile.slice(repoRoot.length + 1)}（${catalog.events.length} 个事件）`,
  )
}
