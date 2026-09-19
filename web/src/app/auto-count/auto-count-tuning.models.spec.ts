import { describe, expect, it } from 'vitest';

import {
  ANGLE_TUNING_PARAMS,
  HOLD_TUNING_PARAMS,
  paramsFor,
  sanitizeTuningValues,
} from './auto-count-tuning.models';

describe('sanitizeTuningValues', () => {
  it('given values inside the allowed range, when sanitized, then they survive', () => {
    // given / when
    const clean = sanitizeTuningValues('angle', {
      upAngleDeg: 150,
      minConfidence: 0.6,
    });

    // then
    expect(clean).toEqual({ upAngleDeg: 150, minConfidence: 0.6 });
  });

  it('given a value outside the slider range, when sanitized, then it is dropped', () => {
    // given — 400° is not an angle any joint reaches
    const raw = { upAngleDeg: 400, downAngleDeg: 90 };

    // when
    const clean = sanitizeTuningValues('angle', raw);

    // then
    expect(clean).toEqual({ downAngleDeg: 90 });
  });

  it('given a key that belongs to the other detector, when sanitized, then it is dropped', () => {
    // given
    const raw = { inPoseAngleDeg: 160, upAngleDeg: 150 };

    // when
    const clean = sanitizeTuningValues('angle', raw);

    // then
    expect(clean).toEqual({ upAngleDeg: 150 });
  });

  it('given non-numeric or non-finite values, when sanitized, then they are dropped', () => {
    // given
    const raw = {
      upAngleDeg: '150',
      downAngleDeg: Number.NaN,
      minDwellMs: Number.POSITIVE_INFINITY,
      maxFrameGapMs: 500,
    };

    // when
    const clean = sanitizeTuningValues('angle', raw);

    // then
    expect(clean).toEqual({ maxFrameGapMs: 500 });
  });

  it('given a malformed document, when sanitized, then the result is empty rather than throwing', () => {
    // given / when / then
    expect(sanitizeTuningValues('angle', null)).toEqual({});
    expect(sanitizeTuningValues('angle', 'nope')).toEqual({});
    expect(sanitizeTuningValues('hold', undefined)).toEqual({});
  });

  it('given the hold kind, when sanitized, then hold thresholds are accepted', () => {
    // given / when
    const clean = sanitizeTuningValues('hold', {
      inPoseAngleDeg: 165,
      minBreakMs: 900,
    });

    // then
    expect(clean).toEqual({ inPoseAngleDeg: 165, minBreakMs: 900 });
  });
});

describe('paramsFor', () => {
  it('given each kind, when resolved, then the matching descriptor list is returned', () => {
    // given / when / then
    expect(paramsFor('angle')).toBe(ANGLE_TUNING_PARAMS);
    expect(paramsFor('hold')).toBe(HOLD_TUNING_PARAMS);
  });

  it('given every descriptor, then its range is usable as a slider', () => {
    // given
    const all = [...ANGLE_TUNING_PARAMS, ...HOLD_TUNING_PARAMS];

    // when / then
    for (const param of all) {
      expect(param.max).toBeGreaterThan(param.min);
      expect(param.step).toBeGreaterThan(0);
      expect(param.label.length).toBeGreaterThan(0);
    }
  });
});
