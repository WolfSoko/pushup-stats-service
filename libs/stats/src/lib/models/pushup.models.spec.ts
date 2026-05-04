import {
  PUSHUP_REPS_MAX,
  PUSHUP_REPS_MIN,
  validatePushupReps,
} from './pushup.models';

describe('validatePushupReps', () => {
  describe('Given a valid integer in range', () => {
    it.each([PUSHUP_REPS_MIN, 1, 50, 200, PUSHUP_REPS_MAX])(
      'Then %i passes validation',
      (reps) => {
        expect(validatePushupReps(reps)).toBeNull();
      }
    );
  });

  describe('Given a non-integer numeric value', () => {
    it.each([1.5, 0.1, Math.PI])(
      'Then %f is rejected as not-integer',
      (reps) => {
        expect(validatePushupReps(reps)).toBe('not-integer');
      }
    );

    it('rejects NaN', () => {
      expect(validatePushupReps(Number.NaN)).toBe('not-integer');
    });

    it('rejects Infinity', () => {
      expect(validatePushupReps(Number.POSITIVE_INFINITY)).toBe('not-integer');
    });
  });

  describe('Given a non-number type', () => {
    it.each(['10', null, undefined, true, [], {}])(
      'Then %p is rejected as not-integer',
      (reps) => {
        expect(validatePushupReps(reps)).toBe('not-integer');
      }
    );
  });

  describe('Given an out-of-range integer', () => {
    it.each([0, -1, -100])('Then %i is rejected as out-of-range', (reps) => {
      expect(validatePushupReps(reps)).toBe('out-of-range');
    });

    it('rejects values above the cap', () => {
      expect(validatePushupReps(PUSHUP_REPS_MAX + 1)).toBe('out-of-range');
      expect(validatePushupReps(10_000)).toBe('out-of-range');
    });
  });
});
