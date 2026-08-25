import type { SessionStep } from '@pu-stats/models';
import { describe, expect, it } from 'vitest';

import { buildSessionRows, formatCountdown } from './training-session.rows';

function step(overrides: Partial<SessionStep> = {}): SessionStep {
  return {
    itemIndex: 0,
    exercise: { exerciseId: 'pushup', target: 15 },
    tool: 'auto-count',
    target: 15,
    logged: 0,
    quantified: true,
    done: false,
    ...overrides,
  };
}

describe('buildSessionRows', () => {
  it('should format a rep target in reps', () => {
    // given / when
    const [row] = buildSessionRows([step()]);

    // then
    expect(row.target).toBe('15');
    expect(row.tool).toBe('auto-count');
    expect(row.icon).toBe('fitness_center');
  });

  it('should format a hold target as a duration', () => {
    // given
    const s = step({
      exercise: { exerciseId: 'plank.standard', target: 50 },
      tool: 'hold-timer',
      target: 50,
      logged: 20,
    });

    // when
    const [row] = buildSessionRows([s]);

    // then
    expect(row.target).toBe('0:50');
    expect(row.logged).toBe('0:20');
  });

  it('should render the set breakdown only when there is more than one', () => {
    // given
    const single = step({
      exercise: { exerciseId: 'pushup', target: 15, sets: [15] },
    });
    const multi = step({
      exercise: { exerciseId: 'pushup', target: 37, sets: [15, 12, 10] },
      target: 37,
    });

    // when
    const [singleRow] = buildSessionRows([single]);
    const [multiRow] = buildSessionRows([multi]);

    // then
    expect(singleRow.sets).toBe('');
    expect(multiRow.sets).toBe('15 · 12 · 10');
  });

  it('should append the prescribed variant to the name', () => {
    // given
    const s = step({
      exercise: {
        exerciseId: 'abs.russiantwist',
        target: 20,
        variantId: 'weighted',
      },
      tool: 'manual',
      target: 20,
    });

    // when
    const [row] = buildSessionRows([s]);

    // then
    expect(row.name).toContain('·');
  });

  it('should compute the progress percentage against the target', () => {
    // given
    const s = step({ logged: 5, target: 15 });

    // when
    const [row] = buildSessionRows([s]);

    // then
    expect(row.percent).toBe(33);
  });

  it('should cap the progress percentage at 100', () => {
    // given
    const s = step({ logged: 30, target: 15 });

    // when
    const [row] = buildSessionRows([s]);

    // then
    expect(row.percent).toBe(100);
  });

  it('should leave the amounts empty for an unquantified step', () => {
    // given
    const s = step({
      exercise: { exerciseId: 'pushup', target: 0 },
      target: 0,
      quantified: false,
    });

    // when
    const [row] = buildSessionRows([s]);

    // then
    expect(row.target).toBe('');
    expect(row.logged).toBe('');
    expect(row.percent).toBe(0);
  });

  it('should fall back to a default icon for an unresolvable exercise', () => {
    // given
    const s = step({ exercise: { exerciseId: 'not.real', target: 5 } });

    // when
    const [row] = buildSessionRows([s]);

    // then
    expect(row.icon).toBe('fitness_center');
  });
});

describe('formatCountdown', () => {
  it('should render seconds under a minute', () => {
    // given / when / then
    expect(formatCountdown(45)).toBe('0:45');
  });

  it('should pad the seconds past a minute', () => {
    // given / when / then
    expect(formatCountdown(65)).toBe('1:05');
  });

  it('should render zero', () => {
    // given / when / then
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('should clamp a negative countdown to zero', () => {
    // given / when / then
    expect(formatCountdown(-5)).toBe('0:00');
  });
});
