#!/usr/bin/env node
/**
 * 前端 fork 的**双向**同步状态检查（上游视角：ypbin-admin-ui ⇄ ypbin-iot-ui）。
 *
 * 同一份脚本放在两个仓里，**对照基准**由环境变量决定：
 *   · 在 ypbin-iot-ui（fork）里跑：ADMIN_UI_ROOT 指向本仓（admin-ui）⇒ 看「fork 落后/领先我什么」；
 *   · 在 ypbin-admin-ui（上游）里跑：FORK_UI_ROOT 指向 fork（iot-ui）⇒ 看「fork 领先我什么」
 *     ——这一侧的意义是**反哺探测**：fork 里领先的通用修复应当被本仓采纳。
 *
 *
 * ## 为什么需要它
 * 后端 fork（ypbin-iot）有一套机器门禁：`tools/sync-whitelist-regex.sh` +
 * `Sync Whitelist` / `Upstream Sync Check` 两个工作流。前端这边此前**只有文档**（SYNC.md），
 * 靠人记——结果实测漂移了两个月的分叉点（SYNC.md 写 09-18，实际 11-11）。
 *
 * ## 与后端门禁的关键差异：**双向**
 * 后端只判「本仓改过哪些 admin 文件」（落后侧）。前端必须**同时判领先侧**：
 * 2026-11-21 实测 iot-ui 相对 admin-ui「落后 52 个文件、领先 24 个文件」——
 * 领先的那批是通用缺陷修复（生产密钥守卫、SSE 断开误报、标签页 path 去重）沉在 fork 里没反哺。
 * 只做「落后侧合并」会让这些修复永远回不去上游。
 *
 * ## 用法
 *   node scripts/check-fork-sync.mjs                    # 报告模式（打印清单，永远 exit 0）
 *   node scripts/check-fork-sync.mjs --check            # 门禁模式（存在未登记漂移即 exit 1）
 *   ADMIN_UI_ROOT=/path/to/ypbin-admin-ui node scripts/check-fork-sync.mjs
 *
 * 默认 admin-ui 检出于 `<repo>/../ypbin-admin-ui`（CI 里由 checkout 指定 ADMIN_UI_ROOT）。
 *
 * ## 判据（三条，逐条可解释）
 * 1. **分歧面**：两边都存在、且内容不同的文件 = 分歧面。
 * 2. **允许清单**：分歧面上每一条都必须是「已登记的 fork 定制」——登记在
 *    `SYNC.md` 的 `<!-- fork-sync:keep -->` 代码块里（一行一个路径，支持 `**` 通配）。
 *    未登记的 ⇒ 报红（要求人判断：是对齐上游，还是登记为定制并写理由）。
 * 3. **领先/落后**：按两仓该文件的最后一次提交时间判定方向，分别计数并打印。
 *    这是**信息性**的（不单独判红）——方向本身不构成违规，登记才是。
 *
 * ## 为什么允许清单放在 SYNC.md 而不是单独 JSON
 * 登记必须有**理由**。放在文档里，理由和清单写在一起、评审时一眼能看到；
 * 单独 JSON 只会变成一堆路径，理由必然散落。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const adminRoot = resolve(
  process.env.FORK_UI_ROOT ||
    process.env.ADMIN_UI_ROOT ||
    join(repoRoot, '..', 'ypbin-iot-ui'),
);
const checkMode = process.argv.includes('--check');

/** 参与比对的目录：只比「两仓共有」的公共部分（IoT 专属页面只在本仓，不需要登记）。 */
const SCOPES = ['apps/web-antd/src', 'packages', 'internal'];

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function trackedFiles(root) {
  return git(root, ['ls-files', ...SCOPES]).split('\n').filter(Boolean);
}

/** 从 SYNC.md 的 `<!-- fork-sync:keep -->` 代码块读出允许清单。 */
function loadAllowList() {
  const syncMd = join(repoRoot, 'SYNC.md');
  if (!existsSync(syncMd)) {
    return [];
  }
  const text = readFileSync(syncMd, 'utf8');
  const block = /<!-- fork-sync:keep -->([\s\S]*?)<!-- \/fork-sync:keep -->/.exec(text);
  if (!block) {
    return [];
  }
  return block[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((pattern) => {
      // `**` → 任意层级；`*` → 单层；其余按字面
      const re = pattern
        .replaceAll(/[.+^${}()|[\]\\]/g, '\\$&')
        .replaceAll('**', '\u0000')
        .replaceAll('*', '[^/]*')
        .replaceAll('\u0000', '.*');
      return { pattern, re: new RegExp(`^${re}$`) };
    });
}

function lastCommitTime(root, file) {
  try {
    const out = git(root, ['log', '-1', '--format=%at', '--', file]);
    return out ? Number(out) : 0;
  } catch {
    return 0;
  }
}

function main() {
  if (!existsSync(join(adminRoot, '.git'))) {
    console.error(
      `✖ 找不到对照仓库（fork）：${adminRoot}\n` +
        '  请设置 FORK_UI_ROOT 指向 ypbin-iot-ui 的检出目录，或把两个仓放在同一父目录下。',
    );
    process.exit(2);
  }

  const mine = new Set(trackedFiles(repoRoot));
  const theirs = new Set(trackedFiles(adminRoot));
  const allow = loadAllowList();

  const divergent = [];
  for (const file of mine) {
    if (!theirs.has(file)) continue; // 只在本仓（IoT 专属），不参与
    const a = join(repoRoot, file);
    const b = join(adminRoot, file);
    if (readFileSync(a).equals(readFileSync(b))) continue;
    divergent.push(file);
  }
  divergent.sort();

  const unregistered = divergent.filter(
    (file) => !allow.some(({ re }) => re.test(file)),
  );

  // 方向判定（信息性）
  const lag = [];
  const lead = [];
  for (const file of divergent) {
    const tMine = lastCommitTime(repoRoot, file);
    const tTheirs = lastCommitTime(adminRoot, file);
    (tTheirs > tMine ? lag : lead).push(file);
  }

  console.log(`# 前端 fork 同步状态（${repoRoot.split('/').pop()} ← ${adminRoot.split('/').pop()}）`);
  console.log(`公共目录：${SCOPES.join(' / ')}`);
  console.log(`分歧面：${divergent.length} 个文件（已登记 ${divergent.length - unregistered.length}，未登记 ${unregistered.length}）`);
  console.log(`方向：本仓较旧 ${lag.length} 个 / 本仓较新 ${lead.length} 个`);
  console.log('');

  if (divergent.length > 0) {
    console.log('## 分歧清单');
    for (const file of divergent) {
      const tag = unregistered.includes(file) ? '未登记' : '已登记';
      const dir = lag.includes(file) ? 'LAG ' : 'LEAD';
      console.log(`  [${tag}] ${dir} ${file}`);
    }
    console.log('');
  }

  if (unregistered.length === 0) {
    console.log('✓ 所有分歧都已登记（或没有分歧）');
    return 0;
  }

  console.error('✖ 存在未登记的分歧：请逐个判断——');
  console.error('   · 应当对齐上游 → 直接改成与 admin-ui 一致；');
  console.error('   · 确属本仓定制 → 在 SYNC.md 的 <!-- fork-sync:keep --> 块里登记该路径并写理由；');
  console.error('   · 若属通用缺陷修复 → 按「底层能力反哺」纪律回植 admin-ui，然后两边一起消掉分歧。');
  console.error('');
  console.error('未登记清单：');
  for (const file of unregistered) console.error(`  ${file}`);
  return checkMode ? 1 : 0;
}

process.exit(main());
