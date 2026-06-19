import type { ComplexGoalEntry, ComplexGoals } from '@pu-stats/models';
import {
  buildExerciseOptions,
  clampTargetForEntry,
  clampTargetToOption,
  cloneGoals,
  findOption,
  makeEntryId,
  normaliseWeekdays,
  scopesEqual,
  targetFromInput,
  targetLabel,
} from './goals-page.helpers';
import type { ExercisePickerEntry } from './goals-page.models';

const repsOption: ExercisePickerEntry = {
  id: 'legs.squats',
  label: 'Squats',
  measurement: 'reps',
  unit: 'reps',
  min: 1,
  max: 500,
};

function entry(overrides: Partial<ComplexGoalEntry> = {}): ComplexGoalEntry {
  return {
    id: 'e1',
    exerciseId: 'pushup',
    target: 10,
    measurement: 'reps',
    unit: 'reps',
    ...overrides,
  };
}

describe('goals-page.helpers', () => {
  describe('buildExerciseOptions', () => {
    it('should map every catalog exercise to a picker entry with bounds', () => {
      // when
      const options = buildExerciseOptions();

      // then
      expect(options.length).toBeGreaterThan(0);
      for (const opt of options) {
        expect(typeof opt.id).toBe('string');
        expect(typeof opt.label).toBe('string');
        expect(typeof opt.min).toBe('number');
        expect(typeof opt.max).toBe('number');
      }
    });
  });

  describe('makeEntryId', () => {
    it('should return a non-empty unique string per call', () => {
      // when
      const a = makeEntryId();
      const b = makeEntryId();

      // then
      expect(a.length).toBeGreaterThan(0);
      expect(a).not.toBe(b);
    });
  });

  describe('findOption', () => {
    it('should return the matching option', () => {
      // given
      const options = [repsOption];

      // when / then
      expect(findOption(options, 'legs.squats')).toBe(repsOption);
    });

    it('should return undefined for an unknown id', () => {
      // when / then
      expect(findOption([repsOption], 'nope')).toBeUndefined();
    });
  });

  describe('clampTargetToOption', () => {
    it('should keep an in-range value untouched', () => {
      // when / then
      expect(clampTargetToOption(50, repsOption)).toBe(50);
    });

    it('should clamp above max down to max', () => {
      // when / then
      expect(clampTargetToOption(9999, repsOption)).toBe(500);
    });

    it('should substitute min when the target is falsy', () => {
      // when / then
      expect(clampTargetToOption(0, repsOption)).toBe(repsOption.min);
    });

    it('should clamp below min up to min', () => {
      // given
      const opt: ExercisePickerEntry = { ...repsOption, min: 5 };

      // when / then
      expect(clampTargetToOption(2, opt)).toBe(5);
    });
  });

  describe('clampTargetForEntry', () => {
    it('should truncate and clamp within the option range', () => {
      // when / then
      expect(clampTargetForEntry(42.9, repsOption)).toBe(42);
    });

    it('should default to min=1 / max=MAX_SAFE_INTEGER when option missing', () => {
      // when / then
      expect(clampTargetForEntry(0.4, undefined)).toBe(1);
      expect(clampTargetForEntry(Number.MAX_SAFE_INTEGER, undefined)).toBe(
        Number.MAX_SAFE_INTEGER
      );
    });

    it('should clamp above the option max', () => {
      // when / then
      expect(clampTargetForEntry(1000, repsOption)).toBe(500);
    });
  });

  describe('normaliseWeekdays', () => {
    it('should sort, keep only integers in 0..6', () => {
      // when / then
      expect(normaliseWeekdays([5, 1, 3])).toEqual([1, 3, 5]);
    });

    it('should drop out-of-range and non-integer values', () => {
      // when / then
      expect(normaliseWeekdays([7, -1, 2.5, 0, 6])).toEqual([0, 6]);
    });

    it('should treat undefined as empty', () => {
      // when / then
      expect(normaliseWeekdays(undefined)).toEqual([]);
    });
  });

  describe('targetLabel', () => {
    it('should label time measurements in seconds', () => {
      // when / then
      expect(targetLabel(entry({ measurement: 'time' }))).toContain('Sekunden');
    });

    it('should label distance measurements in meters', () => {
      // when / then
      expect(targetLabel(entry({ measurement: 'distance' }))).toContain(
        'Meter'
      );
      expect(targetLabel(entry({ measurement: 'distance-time' }))).toContain(
        'Meter'
      );
    });

    it('should fall back to the generic reps label', () => {
      // when / then
      expect(targetLabel(entry({ measurement: 'reps' }))).toBe('Ziel');
      expect(targetLabel(entry({ measurement: 'weight' }))).toBe('Ziel');
    });
  });

  describe('targetFromInput', () => {
    function evt(value: string): Event {
      return { target: { value } } as unknown as Event;
    }

    it('should parse a numeric string', () => {
      // when / then
      expect(targetFromInput(evt('25'), 1)).toBe(25);
    });

    it('should return the fallback for an empty string', () => {
      // when / then
      expect(targetFromInput(evt(''), 7)).toBe(7);
    });

    it('should return the fallback for a non-numeric string', () => {
      // when / then
      expect(targetFromInput(evt('abc'), 3)).toBe(3);
    });
  });

  describe('cloneGoals', () => {
    it('should produce shallow copies of each scope array', () => {
      // given
      const goals: ComplexGoals = {
        daily: [entry({ id: 'd' })],
        weekly: [],
        monthly: [],
      };

      // when
      const clone = cloneGoals(goals);

      // then
      expect(clone).toEqual(goals);
      expect(clone.daily).not.toBe(goals.daily);
    });

    it('should normalise missing scopes to empty arrays', () => {
      // when
      const clone = cloneGoals({} as ComplexGoals);

      // then
      expect(clone).toEqual({ daily: [], weekly: [], monthly: [] });
    });
  });

  describe('scopesEqual', () => {
    const base: ComplexGoals = {
      daily: [entry({ id: 'd', target: 10 })],
      weekly: [],
      monthly: [],
    };

    it('should be true for structurally identical goals', () => {
      // when / then
      expect(scopesEqual(base, cloneGoals(base))).toBe(true);
    });

    it('should be false when a target differs', () => {
      // given
      const changed: ComplexGoals = {
        ...base,
        daily: [entry({ id: 'd', target: 11 })],
      };

      // when / then
      expect(scopesEqual(base, changed)).toBe(false);
    });

    it('should be false when list lengths differ', () => {
      // given
      const changed: ComplexGoals = {
        ...base,
        weekly: [entry({ id: 'w' })],
      };

      // when / then
      expect(scopesEqual(base, changed)).toBe(false);
    });

    it('should compare weekdays element-wise', () => {
      // given
      const a: ComplexGoals = {
        daily: [entry({ id: 'd', weekdays: [1, 2] })],
        weekly: [],
        monthly: [],
      };
      const b: ComplexGoals = {
        daily: [entry({ id: 'd', weekdays: [1, 3] })],
        weekly: [],
        monthly: [],
      };

      // when / then
      expect(scopesEqual(a, b)).toBe(false);
    });

    it('should treat missing scopes as empty', () => {
      // when / then
      expect(
        scopesEqual({} as ComplexGoals, {
          daily: [],
          weekly: [],
          monthly: [],
        })
      ).toBe(true);
    });
  });
});
