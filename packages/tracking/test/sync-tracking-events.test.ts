// @vitest-environment node
/**
 * 事件目录生成器的**自检回归测试**（`scripts/sync-tracking-events.mjs`）。
 *
 * 覆盖的是一整类「假绿」：生成器接受了运行时/TS 都无法消化的数据，`--check` 仍退 0，
 * 直到下游 `typecheck` 或宿主启动才暴露。三组断言各自能反向证明：
 *
 *   1. 非法数据必须**当场失败**（退 2 + 指明原因/位置），而不是静默产出；
 *   2. 合法数据必须**仍被接受**（退 0），且生成物能被真正解析、取值往返一致——
 *      只断言"退 2"会把"一律拒绝"误判成修复成功；
 *   3. 跨层覆盖（合法）与同层重复（数据错误）必须被区分开。
 *
 * 夹具全部在 `os.tmpdir()` 下现造：脚本按自身位置推导产物路径，故把脚本复制进一个假 repo 根再执行，
 * 真实仓库的 `packages/tracking/src/events.generated.ts` 不会被本次测试碰到。
 *
 * **为什么放 `test/` 而不是 `src/`**：本包 `src` 是浏览器代码，`tsconfig.json` 继承
 * `@vben/tsconfig/web.json`（`types: ["vite/client"]`，不含 node），而本测试需要 `node:child_process` 等
 * 内建模块。放在 `test/` 既让包自身的 `test` 脚本照常跑到它，又不必为了测试给**浏览器 SDK** 打开 node
 * 全局类型。代价是它不参与 `vue-tsc` 类型检查（只经 vitest 转译），由 oxlint 与本文件的断言兜底。
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

/** 生成器脚本（真实仓库内的那一份，逐字复制到假 repo 根） */
const generatorScript = new URL(
  '../../../scripts/sync-tracking-events.mjs',
  import.meta.url,
).pathname;

/** 本次测试创建的全部临时根目录，结束后清理 */
const tempRoots: string[] = [];

afterAll(() => {
  for (const root of tempRoots) {
    rmSync(root, { force: true, recursive: true });
  }
});

/** 一条合法事件（用作夹具的默认骨架，避免每个用例重复写全字段） */
function event(code: string, description = '说明'): Record<string, unknown> {
  return {
    code,
    description,
    properties: [],
    since: '3.0.0',
    source: 'web',
  };
}

interface Fixture {
  base: Record<string, unknown>;
  project?: Record<string, unknown>;
}

/**
 * 在临时目录里跑一遍生成器。
 *
 * @param fixture   base / project 两层目录数据
 * @param checkMode 是否加 `--check`
 * @param reuseRoot 复用已有临时根（`--check` 必须与生成共用同一个根，否则产物根本不存在，
 *                  量到的是「漂移 1」而不是本用例想验的行为）
 * @returns 退出码、stderr、产物路径与临时根
 */
function runGenerator(fixture: Fixture, checkMode = false, reuseRoot?: string) {
  const root = reuseRoot ?? mkdtempSync(join(tmpdir(), 'tracking-gen-'));
  if (!reuseRoot) {
    tempRoots.push(root);
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'packages', 'tracking', 'src'), { recursive: true });
    mkdirSync(join(root, 'starter', 'docs'), { recursive: true });
    cpSync(generatorScript, join(root, 'scripts', 'sync-tracking-events.mjs'));
    writeFileSync(
      join(root, 'starter', 'docs', 'tracking-events.json'),
      JSON.stringify(fixture.base, null, 2),
    );
    if (fixture.project) {
      writeFileSync(
        join(root, 'project.json'),
        JSON.stringify(fixture.project, null, 2),
      );
    }
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    STARTER_REPO_ROOT: join(root, 'starter'),
  };
  // 默认宿主路径（同级 ../ypbin-admin）与本夹具无关，必须显式清掉，否则会读到真实宿主仓
  delete env.HOST_REPO_ROOT;
  delete env.HOST_TRACKING_EVENTS;
  if (fixture.project) {
    env.HOST_TRACKING_EVENTS = join(root, 'project.json');
  }
  const result = spawnSync(
    process.execPath,
    [
      join(root, 'scripts', 'sync-tracking-events.mjs'),
      ...(checkMode ? ['--check'] : []),
    ],
    { encoding: 'utf8', env },
  );
  return {
    checkStderr: result.stderr,
    root,
    status: result.status,
    target: join(root, 'packages', 'tracking', 'src', 'events.generated.ts'),
  };
}

/**
 * 断言生成物是**语法合法**的 TS：用 Node 的类型剥离直接解析它（无需 tsc，低配机也能跑），
 * 并把模块导出取回，供调用方继续断言取值。
 */
async function importGenerated(target: string) {
  const parsed = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `await import(${JSON.stringify(pathToFileURL(target).href)})`,
    ],
    { encoding: 'utf8' },
  );
  expect(parsed.stderr).toBe('');
  expect(parsed.status).toBe(0);
  return import(pathToFileURL(target).href);
}

describe('埋点事件目录生成器自检', () => {
  it('description 含换行：转义后写入，生成物语法合法且取值往返一致', async () => {
    const description = '页面浏览：\n第二行（含裸换行）';
    const fixture: Fixture = {
      base: {
        events: [event('ui.page.view', description)],
        schemaVersion: 1,
      },
    };
    const generated = runGenerator(fixture);
    // 运行时接受含换行的 description，故这里不比运行时更严——是**转义**而不是拒绝
    expect(generated.status).toBe(0);
    expect(runGenerator(fixture, true, generated.root).status).toBe(0);

    const module = await importGenerated(generated.target);
    expect(module.TRACKING_EVENT_CATALOG['ui.page.view'].description).toBe(
      description,
    );
  });

  it.each([{}, '128', 12.5, 0, -1])(
    'maxLength 非正整数（%j）：退 2 并指明字段',
    (maxLength) => {
      const fixture: Fixture = {
        base: {
          events: [
            {
              ...event('ui.page.view'),
              properties: [
                {
                  description: '路由标识',
                  maxLength,
                  name: 'routeKey',
                  type: 'string',
                },
              ],
            },
          ],
          schemaVersion: 1,
        },
      };
      const generated = runGenerator(fixture);
      expect(generated.status).toBe(2);
      expect(generated.checkStderr).toContain('maxLength 必须是正整数');
      expect(runGenerator(fixture, true, generated.root).status).toBe(2);
    },
  );

  it('events 为空数组（base 层）：退 2，理由与运行时启动失败一致', () => {
    const generated = runGenerator({
      base: { events: [], schemaVersion: 1 },
    });
    expect(generated.status).toBe(2);
    expect(generated.checkStderr).toContain('events 不能为空数组');
    expect(generated.checkStderr).toContain('has no events');
  });

  it('events 为空数组（project 层）：同样退 2（运行时会为该项目资源启动失败）', () => {
    const generated = runGenerator({
      base: { events: [event('ui.page.view')], schemaVersion: 1 },
      project: { events: [], schemaVersion: 1 },
    });
    expect(generated.status).toBe(2);
    expect(generated.checkStderr).toContain('project 层事件目录结构不合法');
    expect(generated.checkStderr).toContain('events 不能为空数组');
  });

  it('同层重复事件码（base 层）：退 2，指出码与两个位置，且不再声称"被 project 覆盖"', () => {
    const generated = runGenerator({
      base: {
        events: [event('ui.page.view'), event('ui.page.view', '重复定义')],
        schemaVersion: 1,
      },
    });
    expect(generated.status).toBe(2);
    expect(generated.checkStderr).toContain('重复事件码 ui.page.view');
    expect(generated.checkStderr).toContain('第 1 条与第 2 条');
    // 反向证明：同层重复绝不能被当成「覆盖」
    expect(generated.checkStderr).not.toContain('被宿主 project 层覆盖');
  });

  it('同层重复事件码（project 层）：退 2，而不是打印两次"被 project 覆盖"', () => {
    const generated = runGenerator({
      base: { events: [event('ui.page.view')], schemaVersion: 1 },
      project: {
        events: [
          event('ui.page.view', 'project 第一份'),
          event('ui.page.view', 'project 第二份'),
        ],
        schemaVersion: 1,
      },
    });
    expect(generated.status).toBe(2);
    expect(generated.checkStderr).toContain('重复事件码 ui.page.view');
    expect(generated.checkStderr).toContain('第 1 条与第 2 条');
    expect(generated.checkStderr).not.toContain('被宿主 project 层覆盖');
  });

  it('跨层同码（合法覆盖）：仍退 0 并打印 WARN —— 与同层重复必须可区分', () => {
    const fixture: Fixture = {
      base: { events: [event('ui.page.view', 'base 说明')], schemaVersion: 1 },
      project: {
        events: [event('ui.page.view', 'project 说明')],
        schemaVersion: 1,
      },
    };
    const generated = runGenerator(fixture);
    expect(generated.status).toBe(0);
    const checked = runGenerator(fixture, true, generated.root);
    expect(checked.status).toBe(0);
    expect(checked.checkStderr).toContain('被宿主 project 层覆盖');
  });

  it('事件码无法派生合法 TS 常量名：退 2（生成器能力边界，运行时不拦）', () => {
    const generated = runGenerator({
      base: {
        events: [event('ui.page.view!')],
        schemaVersion: 1,
      },
    });
    expect(generated.status).toBe(2);
    expect(generated.checkStderr).toContain('无法派生合法的 TS 常量名');
  });

  it('属性名非标识符：不拒绝，改为加引号的键，生成物仍可解析且往返一致', async () => {
    const fixture: Fixture = {
      base: {
        events: [
          {
            ...event('ui.page.view'),
            properties: [
              {
                description: '说明',
                maxLength: 128,
                name: 'my prop',
                type: 'string',
              },
            ],
          },
        ],
        schemaVersion: 1,
      },
    };
    const generated = runGenerator(fixture);
    expect(generated.status).toBe(0);

    const module = await importGenerated(generated.target);
    expect(module.TRACKING_EVENT_PROPERTIES['ui.page.view']).toStrictEqual({
      'my prop': 128,
    });
  });

  it('type 不在运行时支持集内：退 2（未知类型会让该属性取值被静默丢弃）', () => {
    const generated = runGenerator({
      base: {
        events: [
          {
            ...event('ui.page.view'),
            properties: [
              { description: '说明', name: 'routeKey', type: 'strng' },
            ],
          },
        ],
        schemaVersion: 1,
      },
    });
    expect(generated.status).toBe(2);
    expect(generated.checkStderr).toContain('type 非法');
  });
});
