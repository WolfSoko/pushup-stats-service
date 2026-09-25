import { EXERCISE_CATALOG } from './exercise.catalog';
import { DEFAULT_XP_RATES } from './xp-rates.catalog';
import {
  isValidXpRate,
  parseXpConfig,
  levelForXp,
  levelProgress,
  xpForEntry,
  xpForLevel,
  xpRateFor,
  xpRateUnit,
} from './xp.models';

describe('DEFAULT_XP_RATES', () => {
  it('should define a valid rate for every catalog exercise that has a rate unit', () => {
    // given
    const rated = EXERCISE_CATALOG.filter((e) => xpRateUnit(e.measurement));

    // then
    for (const exercise of rated) {
      expect([
        exercise.id,
        isValidXpRate(DEFAULT_XP_RATES[exercise.id]),
      ]).toEqual([exercise.id, true]);
    }
  });

  it('should not carry rates for ids the catalog does not know', () => {
    // given
    const ids = new Set(EXERCISE_CATALOG.map((e) => e.id));

    // then
    expect(Object.keys(DEFAULT_XP_RATES).filter((id) => !ids.has(id))).toEqual(
      []
    );
  });
});

describe('xpRateFor', () => {
  it('should fall back to the shipped default without an override', () => {
    // when
    const rate = xpRateFor('pull.pullups', null);

    // then
    expect(rate).toBe(DEFAULT_XP_RATES['pull.pullups']);
  });

  it('should prefer a valid admin override', () => {
    // when
    const rate = xpRateFor('pushup', { rates: { pushup: 2.5 } });

    // then
    expect(rate).toBe(2.5);
  });

  it('should ignore an invalid override', () => {
    // when
    const rate = xpRateFor('pushup', { rates: { pushup: -1 } });

    // then
    expect(rate).toBe(DEFAULT_XP_RATES['pushup']);
  });

  it('should rate an unknown exercise with zero', () => {
    // then
    expect(xpRateFor('custom.unknown', null)).toBe(0);
  });
});

describe('xpForEntry', () => {
  it('should multiply reps by the per-rep rate', () => {
    // when
    const xp = xpForEntry({ exerciseId: 'pull.pullups', reps: 10 }, 3);

    // then
    expect(xp).toBe(30);
  });

  it('should convert seconds into minutes for time exercises', () => {
    // when
    const xp = xpForEntry({ exerciseId: 'plank.standard', durationSec: 90 }, 8);

    // then
    expect(xp).toBe(12);
  });

  it('should convert metres into kilometres for distance-time exercises', () => {
    // when
    const xp = xpForEntry(
      { exerciseId: 'cardio.running', distanceM: 5000, durationSec: 1500 },
      60
    );

    // then
    expect(xp).toBe(300);
  });

  it('should round to whole XP', () => {
    // when
    const xp = xpForEntry({ exerciseId: 'abs.crunches', reps: 5 }, 0.3);

    // then
    expect(xp).toBe(2);
  });

  it('should give nothing for an unknown exercise or a missing value', () => {
    // then
    expect(xpForEntry({ exerciseId: 'nope', reps: 10 }, 1)).toBe(0);
    expect(xpForEntry({ exerciseId: 'pushup' }, 1)).toBe(0);
    expect(xpForEntry({ exerciseId: 'pushup', reps: Number.NaN }, 1)).toBe(0);
  });
});

describe('levels', () => {
  it('should start everyone at level 1', () => {
    // then
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(-5)).toBe(1);
  });

  it.each([
    [2, 100],
    [3, 300],
    [10, 4500],
    [100, 495000],
  ])('should reach level %i at exactly %i XP', (level, xp) => {
    // then
    expect(xpForLevel(level)).toBe(xp);
    expect(levelForXp(xp)).toBe(level);
    expect(levelForXp(xp - 1)).toBe(level - 1);
  });

  it('should report progress inside the current level', () => {
    // when
    const progress = levelProgress(200);

    // then
    expect(progress).toEqual({
      level: 2,
      totalXp: 200,
      intoLevel: 100,
      levelSpan: 200,
      fraction: 0.5,
    });
  });
});

describe('parseXpConfig', () => {
  it('should keep valid rates and drop invalid ones', () => {
    // when
    const config = parseXpConfig({
      rates: { pushup: 2, bad: -1, nan: Number.NaN, text: '3' },
    });

    // then
    expect(config).toEqual({ rates: { pushup: 2 } });
  });

  it('should return null without a rates map', () => {
    // then
    expect(parseXpConfig(undefined)).toBeNull();
    expect(parseXpConfig(null)).toBeNull();
    expect(parseXpConfig({ rates: 'x' })).toBeNull();
  });
});
