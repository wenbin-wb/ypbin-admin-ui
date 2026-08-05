/**
 * Cron 表达式解析/生成工具（Spring 6 段：秒 分 时 日 月 周）。
 * 每段支持四种模式：every(*) / specify(指定多值,逗号) / range(a-b) / step(a/b)。
 * 周字段用 ? 表示不指定（与日字段互斥，Spring cron 惯例）。
 */

export type CronPart = 'day' | 'hour' | 'minute' | 'month' | 'second' | 'week';

export type CronMode = 'every' | 'range' | 'specify' | 'step';

export interface CronFieldState {
  mode: CronMode;
  /** specify 模式的多选值 */
  values: number[];
  /** range 模式 [起, 止] */
  rangeStart: number;
  rangeEnd: number;
  /** step 模式 起始/步长 */
  stepStart: number;
  stepValue: number;
}

/** 六段顺序 */
export const CRON_PARTS: CronPart[] = [
  'second',
  'minute',
  'hour',
  'day',
  'month',
  'week',
];

/** 各段取值范围 */
export const PART_RANGE: Record<CronPart, { max: number; min: number }> = {
  second: { min: 0, max: 59 },
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  day: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  week: { min: 1, max: 7 },
};

function defaultField(part: CronPart): CronFieldState {
  const { min } = PART_RANGE[part];
  return {
    mode: 'every',
    values: [],
    rangeStart: min,
    rangeEnd: min + 1,
    stepStart: min,
    stepValue: 1,
  };
}

/** 生成默认六段状态（每秒都触发不现实，默认给 day/month/week 合理初值） */
export function defaultCronState(): Record<CronPart, CronFieldState> {
  return {
    second: defaultField('second'),
    minute: defaultField('minute'),
    hour: defaultField('hour'),
    day: defaultField('day'),
    month: defaultField('month'),
    week: defaultField('week'),
  };
}

/** 单段状态 → cron 片段 */
export function fieldToExpr(part: CronPart, f: CronFieldState): string {
  switch (f.mode) {
    case 'every': {
      // 日/周互斥：默认周用 ?，日用 *
      return part === 'week' ? '?' : '*';
    }
    case 'range': {
      return `${f.rangeStart}-${f.rangeEnd}`;
    }
    case 'specify': {
      if (f.values.length > 0) {
        return [...f.values].toSorted((a, b) => a - b).join(',');
      }
      return part === 'week' ? '?' : '*';
    }
    case 'step': {
      return `${f.stepStart}/${f.stepValue}`;
    }
    default: {
      return '*';
    }
  }
}

/** 六段状态 → 完整 cron 表达式 */
export function stateToCron(state: Record<CronPart, CronFieldState>): string {
  return CRON_PARTS.map((p) => fieldToExpr(p, state[p])).join(' ');
}

/** 解析单段 cron 片段 → 状态（尽力解析，无法识别按 every） */
export function exprToField(part: CronPart, expr: string): CronFieldState {
  const f = defaultField(part);
  const s = (expr ?? '').trim();
  if (s === '' || s === '*' || s === '?') {
    f.mode = 'every';
  } else if (s.includes('/')) {
    const [start, step] = s.split('/');
    f.mode = 'step';
    f.stepStart = Number(start === '*' ? PART_RANGE[part].min : start);
    f.stepValue = Number(step) || 1;
  } else if (s.includes('-')) {
    const [a, b] = s.split('-');
    f.mode = 'range';
    f.rangeStart = Number(a);
    f.rangeEnd = Number(b);
  } else {
    f.mode = 'specify';
    f.values = s
      .split(',')
      .map(Number)
      .filter((v) => !Number.isNaN(v));
  }
  return f;
}

/** 完整 cron → 六段状态（用于回显编辑） */
export function cronToState(cron: string): Record<CronPart, CronFieldState> {
  const parts = (cron ?? '').trim().split(/\s+/);
  const state = defaultCronState();
  if (parts.length >= 6) {
    CRON_PARTS.forEach((p, i) => {
      state[p] = exprToField(p, parts[i] ?? '');
    });
  }
  return state;
}
