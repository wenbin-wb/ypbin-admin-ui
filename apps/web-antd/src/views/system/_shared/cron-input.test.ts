import { describe, expect, it } from 'vitest';

import {
  CronValidationError,
  decodeCron,
  defaultCronState,
  stateToCron,
} from './cron-input';

describe('cron-input codec', () => {
  it('round-trips supported simple expressions', () => {
    for (const expression of [
      '0 0 9 * * ?',
      '0 0 9 ? * 1-5',
      '0 0/15 9 * * ?',
      '0 0 9 1,15 * ?',
    ]) {
      const result = decodeCron(expression);
      expect(result.mode).toBe('simple');
      if (result.mode !== 'simple') throw new Error('Expected simple mode');
      expect(stateToCron(result.state)).toBe(expression);
    }
  });

  it('preserves advanced Spring expressions without rewriting', () => {
    for (const expression of [
      '0 0 0 L * ?',
      '0 0 0 15W * ?',
      '0 0 0 ? * MON#2',
      '@hourly',
    ]) {
      expect(decodeCron(expression)).toMatchObject({
        mode: 'advanced',
        value: expression,
      });
    }
  });

  it('keeps day and week AND expressions in advanced mode', () => {
    expect(decodeCron('0 0 0 15 * 1')).toMatchObject({
      mode: 'advanced',
      reason: 'day-week-and',
    });
  });

  it('uses Spring day-of-week numbering including Sunday zero', () => {
    const result = decodeCron('0 0 9 ? * 0,6');
    expect(result.mode).toBe('simple');
    if (result.mode !== 'simple') throw new Error('Expected simple mode');
    expect(result.state.week.values).toEqual([0, 6]);
  });

  it('returns stable validation codes for invalid simple state', () => {
    const state = defaultCronState();
    state.minute.mode = 'range';
    state.minute.rangeStart = 50;
    state.minute.rangeEnd = 10;
    expect(() => stateToCron(state)).toThrow(
      expect.objectContaining({ code: 'reversed-range', part: 'minute' }),
    );

    state.minute.mode = 'specify';
    state.minute.values = [];
    expect(() => stateToCron(state)).toThrow(
      expect.objectContaining({ code: 'empty-values', part: 'minute' }),
    );

    state.minute.mode = 'step';
    state.minute.stepValue = 0;
    expect(() => stateToCron(state)).toThrow(
      expect.objectContaining({ code: 'invalid-step', part: 'minute' }),
    );
  });

  it('uses a dedicated validation error type', () => {
    const state = defaultCronState();
    state.second.mode = 'specify';
    expect(() => stateToCron(state)).toThrow(CronValidationError);
  });

  it('forces the other calendar field to question mark', () => {
    const state = defaultCronState();
    state.week.mode = 'specify';
    state.week.values = [1];
    expect(stateToCron(state)).toBe('* * * ? * 1');
  });
});
