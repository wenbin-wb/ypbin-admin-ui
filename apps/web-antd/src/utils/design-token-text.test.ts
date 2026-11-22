/**
 * **文本语义色 token 的存在性与对比度门禁**（自 ypbin-iot-ui 反哺，2026-11-22）。
 *
 * ## 为什么需要它
 *
 * 2026-11-22 核查发现本仓的文本语义色**变量链是断的**：
 *
 * ```
 * theme.css:  --color-destructive-text: hsl(var(--destructive-500));
 *             ^ 但 --destructive-500 在本仓**从未定义**（全仓仅此一处引用）
 * ```
 *
 * CSS 里 `var()` 引用未定义的自定义属性 ⇒ 该声明在 computed-value 阶段失效、**被静默丢弃**
 * ⇒ `color` 回落到继承值。表现是「文案看起来正常，但警示色根本没生效」——
 * 渲染层完全测不到，只有做源码/产物级断言才发现。实测本仓有 4 处用法受影响：
 * `space-relation-list.vue`、`space-select.vue`（错误提示）、`import-modal.vue` ×2（覆盖提示）。
 *
 * 修法是接入「文本专用语义色」`--destructive-text / --success-text / --warning-text`
 * （亮暗各一档，见 `packages/@core/base/design/src/design-tokens/{default,dark}.css`），
 * 并让 theme.css 指向它们。本用例把两件事钉死：
 *
 * 1. **存在性**：three 个 token 必须在亮/暗两档都有定义，且 theme.css 不再引用不存在的色阶；
 * 2. **对比度**：亮档对白底、暗档对暗底均须 ≥ 4.5:1（WCAG AA 正文要求）——
 *    原先直接用实心块色 `--destructive/--success/--warning` 当正文色只有 **1.74–3.27:1**，
 *    三个全部不达标。
 *
 * ## 为什么读源文件而不是 getComputedStyle
 *
 * happy-dom 不执行级联/CSS 变量解析，读不到计算值；而这两类问题恰恰是**静态可判**的
 * （写死的 HSL 三元组 + 写死的引用关系），源码级断言比渲染断言更稳、更快、失败信息更准。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** 本测试位于 `apps/web-antd/src/utils/`。 */
const HERE = dirname(fileURLToPath(import.meta.url));
/** 仓根（`apps/web-antd/src/utils` 上溯四级）。 */
const REPO_ROOT = resolve(HERE, '../../../..');
const TOKENS_DIR = resolve(
  REPO_ROOT,
  'packages/@core/base/design/src/design-tokens',
);
const THEME_CSS = resolve(REPO_ROOT, 'internal/tailwind-config/src/theme.css');

/** 需要校验的文本语义 token（名 → 期望存在）。 */
const TEXT_TOKENS = [
  'destructive-text',
  'success-text',
  'warning-text',
] as const;

/** 从 CSS 文本里取 `--name: H S% L%;` 的三元组。 */
function readHsl(css: string, token: string): [number, number, number] | null {
  const re = new RegExp(`--${token}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`);
  const m = re.exec(css);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** HSL → sRGB（0–255），与浏览器一致的换算。 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255)) as [
    number,
    number,
    number,
  ];
}

/** WCAG 相对亮度。 */
function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 对比度。 */
function contrast(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const WHITE: [number, number, number] = [255, 255, 255];
/** 暗色档底色，取自 dark.css 的 `--background: 222.34 10.43% 12.27%`。 */
const DARK_BG = hslToRgb(222.34, 10.43, 12.27);

describe('文本语义色 token', () => {
  const lightCss = readFileSync(resolve(TOKENS_DIR, 'default.css'), 'utf8');
  const darkCss = readFileSync(resolve(TOKENS_DIR, 'dark.css'), 'utf8');
  const themeCss = readFileSync(THEME_CSS, 'utf8');

  it.each(TEXT_TOKENS)(
    '--%s 在亮色档有定义且对白底达到 WCAG AA（4.5:1）',
    (token) => {
      const hsl = readHsl(lightCss, token);
      expect(
        hsl,
        `default.css 缺少 --${token}（文本语义色必须存在，否则 text-*-text 类会静默失效）`,
      ).not.toBeNull();
      const ratio = contrast(hslToRgb(...hsl!), WHITE);
      expect(
        ratio,
        `--${token} 对白底仅 ${ratio.toFixed(2)}:1，未达 AA 4.5:1`,
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(TEXT_TOKENS)(
    '--%s 在暗色档有定义且对暗底达到 WCAG AA（4.5:1）',
    (token) => {
      const hsl = readHsl(darkCss, token);
      expect(hsl, `dark.css 缺少 --${token}`).not.toBeNull();
      const ratio = contrast(hslToRgb(...hsl!), DARK_BG);
      expect(
        ratio,
        `--${token}（暗）对暗底仅 ${ratio.toFixed(2)}:1，未达 AA 4.5:1`,
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('theme.css 的 text-* 色**不得**引用未定义的色阶变量', () => {
    // 反例（修复前的真实状态）：hsl(var(--destructive-500)) —— --destructive-500 全仓无定义。
    // 这里把「引用了什么」与「仓内是否有该定义」对起来，防止以后又写回不存在的色阶。
    const referenced = [
      ...themeCss.matchAll(
        /--color-(?:destructive|success|warning)-text[a-z-]*:\s*hsl\(var\(--([\w-]+)\)\)/g,
      ),
    ].map((m) => m[1]!);
    expect(referenced.length).toBeGreaterThan(0);
    const defined = new Set<string>();
    for (const css of [lightCss, darkCss, themeCss]) {
      for (const m of css.matchAll(/--([\w-]+):/g)) defined.add(m[1]!);
    }
    const dangling = referenced.filter((name) => !defined.has(name));
    expect(
      dangling,
      `theme.css 引用了仓内不存在的变量：${dangling.join(', ')}（会导致该声明被丢弃、颜色静默继承父级）`,
    ).toEqual([]);
  });
});
