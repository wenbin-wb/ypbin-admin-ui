export type CronPart = 'day' | 'hour' | 'minute' | 'month' | 'second' | 'week';
export type CronMode = 'every' | 'range' | 'specify' | 'step';
export type CronEditorMode = 'advanced' | 'simple';
export type CronValidationCode =
  | 'day-week-conflict'
  | 'empty-values'
  | 'invalid-step'
  | 'out-of-range'
  | 'reversed-range'
  | 'unsupported-syntax';

export class CronValidationError extends Error {
  constructor(
    public readonly code: CronValidationCode,
    public readonly part?: CronPart,
  ) {
    super(code);
    this.name = 'CronValidationError';
  }
}

export interface CronFieldState {
  mode: CronMode;
  rangeEnd: number;
  rangeStart: number;
  stepStart: number;
  stepValue: number;
  values: number[];
}

export type CronState = Record<CronPart, CronFieldState>;

export type CronDecodeResult =
  | { mode: 'advanced'; reason: string; value: string }
  | { mode: 'simple'; state: CronState; value: string };

export const CRON_PARTS: CronPart[] = [
  'second',
  'minute',
  'hour',
  'day',
  'month',
  'week',
];

export const PART_RANGE: Record<CronPart, { max: number; min: number }> = {
  second: { min: 0, max: 59 },
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  day: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  week: { min: 0, max: 7 },
};

function defaultField(part: CronPart): CronFieldState {
  const { min } = PART_RANGE[part];
  return {
    mode: 'every',
    rangeEnd: min + 1,
    rangeStart: min,
    stepStart: min,
    stepValue: 1,
    values: [],
  };
}

export function defaultCronState(): CronState {
  return {
    second: defaultField('second'),
    minute: defaultField('minute'),
    hour: defaultField('hour'),
    day: defaultField('day'),
    month: defaultField('month'),
    week: defaultField('week'),
  };
}

function assertInRange(part: CronPart, value: number) {
  const { min, max } = PART_RANGE[part];
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new CronValidationError('out-of-range', part);
  }
}

function fieldToExpression(part: CronPart, field: CronFieldState): string {
  if (field.mode === 'every') return part === 'week' ? '?' : '*';
  if (field.mode === 'specify') {
    if (field.values.length === 0) {
      throw new CronValidationError('empty-values', part);
    }
    field.values.forEach((value) => assertInRange(part, value));
    return [...new Set(field.values)].toSorted((a, b) => a - b).join(',');
  }
  if (field.mode === 'range') {
    assertInRange(part, field.rangeStart);
    assertInRange(part, field.rangeEnd);
    if (field.rangeStart >= field.rangeEnd) {
      throw new CronValidationError('reversed-range', part);
    }
    return `${field.rangeStart}-${field.rangeEnd}`;
  }
  assertInRange(part, field.stepStart);
  if (!Number.isInteger(field.stepValue) || field.stepValue < 1) {
    throw new CronValidationError('invalid-step', part);
  }
  return `${field.stepStart}/${field.stepValue}`;
}

export function stateToCron(state: CronState): string {
  const parts = CRON_PARTS.map((part) => fieldToExpression(part, state[part]));
  const dayRestricted = state.day.mode !== 'every';
  const weekRestricted = state.week.mode !== 'every';
  if (dayRestricted && weekRestricted) {
    throw new CronValidationError('day-week-conflict');
  }
  if (dayRestricted) parts[5] = '?';
  if (weekRestricted) parts[3] = '?';
  return parts.join(' ');
}

function parseNumber(part: CronPart, raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new CronValidationError('unsupported-syntax', part);
  }
  const value = Number(raw);
  assertInRange(part, value);
  return value;
}

function expressionToField(part: CronPart, expression: string): CronFieldState {
  const field = defaultField(part);
  if (expression === '*' || expression === '?') return field;
  if (/[A-Za-zLW#]/.test(expression)) {
    throw new CronValidationError('unsupported-syntax', part);
  }
  if (expression.includes(',')) {
    field.mode = 'specify';
    field.values = expression
      .split(',')
      .map((value) => parseNumber(part, value));
    if (field.values.length === 0) {
      throw new CronValidationError('empty-values', part);
    }
    return field;
  }
  if (expression.includes('/')) {
    const match = expression.match(/^(\d+)\/(\d+)$/);
    const stepStart = match?.[1];
    const stepValue = match?.[2];
    if (stepStart === undefined || stepValue === undefined) {
      throw new CronValidationError('unsupported-syntax', part);
    }
    field.mode = 'step';
    field.stepStart = parseNumber(part, stepStart);
    field.stepValue = Number(stepValue);
    if (!Number.isInteger(field.stepValue) || field.stepValue < 1) {
      throw new CronValidationError('invalid-step', part);
    }
    return field;
  }
  if (expression.includes('-')) {
    const match = expression.match(/^(\d+)-(\d+)$/);
    const rangeStart = match?.[1];
    const rangeEnd = match?.[2];
    if (rangeStart === undefined || rangeEnd === undefined) {
      throw new CronValidationError('unsupported-syntax', part);
    }
    field.mode = 'range';
    field.rangeStart = parseNumber(part, rangeStart);
    field.rangeEnd = parseNumber(part, rangeEnd);
    if (field.rangeStart >= field.rangeEnd) {
      throw new CronValidationError('reversed-range', part);
    }
    return field;
  }
  field.mode = 'specify';
  field.values = [parseNumber(part, expression)];
  return field;
}

export function decodeCron(value: string): CronDecodeResult {
  const original = value.trim();
  if (original.startsWith('@')) {
    return { mode: 'advanced', reason: 'macro', value: original };
  }
  const parts = original.split(/\s+/);
  if (parts.length !== 6) {
    return { mode: 'advanced', reason: 'field-count', value: original };
  }
  try {
    const state = defaultCronState();
    for (const [index, part] of CRON_PARTS.entries()) {
      const expression = parts[index];
      if (expression === undefined) {
        return { mode: 'advanced', reason: 'field-count', value: original };
      }
      state[part] = expressionToField(part, expression);
    }
    if (state.day.mode !== 'every' && state.week.mode !== 'every') {
      return { mode: 'advanced', reason: 'day-week-and', value: original };
    }
    if (stateToCron(state) !== original) {
      return { mode: 'advanced', reason: 'non-lossless', value: original };
    }
    return { mode: 'simple', state, value: original };
  } catch (error) {
    return {
      mode: 'advanced',
      reason: error instanceof Error ? error.message : 'unsupported',
      value: original,
    };
  }
}
