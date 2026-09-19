import { describe, expect, it } from 'vitest';

import {
  formatSignedDelta,
  formatThresholds,
  reportDelta,
} from './admin-auto-count.helpers';
import type { AdminAutoCountReport } from './admin-page.models';

describe('formatThresholds', () => {
  it('given a threshold set, when formatted, then keys are listed in a stable order', () => {
    // given / when
    const text = formatThresholds({ upAngleDeg: 150, downAngleDeg: 90 });

    // then
    expect(text).toBe('downAngleDeg 90 · upAngleDeg 150');
  });

  it('given no overrides, when formatted, then a dash stands in', () => {
    // given / when / then
    expect(formatThresholds({})).toBe('—');
  });
});

describe('formatSignedDelta', () => {
  it('given missed reps, when formatted, then the sign is explicit', () => {
    // given / when / then
    expect(formatSignedDelta(1.5)).toBe('+1.5');
  });

  it('given overcounting, when formatted, then a real minus sign is used', () => {
    // given / when / then
    expect(formatSignedDelta(-0.75)).toBe('−0.75');
  });

  it('given no error at all, when formatted, then it reads as plain zero', () => {
    // given / when / then
    expect(formatSignedDelta(0)).toBe('0');
  });

  it('given a long fraction, when formatted, then it is rounded to two digits', () => {
    // given / when / then
    expect(formatSignedDelta(1.23456)).toBe('+1.23');
  });
});

describe('reportDelta', () => {
  it('given a run where reps were missed, when measured, then the delta is positive', () => {
    // given
    const report = {
      detectedReps: 8,
      actualReps: 10,
    } as AdminAutoCountReport;

    // when / then
    expect(reportDelta(report)).toBe(2);
  });

  it('given a run that counted too many, when measured, then the delta is negative', () => {
    // given
    const report = {
      detectedReps: 12,
      actualReps: 10,
    } as AdminAutoCountReport;

    // when / then
    expect(reportDelta(report)).toBe(-2);
  });
});
