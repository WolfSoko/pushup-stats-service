import { DEFAULT_XP_RATES } from '@pu-stats/models';
import {
  buildXpRateGroups,
  effectiveRates,
  overridesFrom,
  parseXpRateInput,
  sameRates,
} from './admin-xp-rates.helpers';

describe('buildXpRateGroups', () => {
  it('should list every rated exercise once, grouped by category', () => {
    // when
    const groups = buildXpRateGroups();

    // then
    const ids = groups.flatMap((g) => g.rows.map((r) => r.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(Object.keys(DEFAULT_XP_RATES).sort());
  });

  it('should carry the rate unit and default of each exercise', () => {
    // when
    const rows = buildXpRateGroups().flatMap((g) => g.rows);

    // then
    expect(rows.find((r) => r.id === 'plank.standard')).toEqual(
      expect.objectContaining({ unit: 'minute', defaultRate: 8 })
    );
    expect(rows.find((r) => r.id === 'cardio.running')).toEqual(
      expect.objectContaining({ unit: 'km', defaultRate: 60 })
    );
  });
});

describe('effectiveRates', () => {
  it('should overlay valid overrides on the defaults', () => {
    // when
    const rates = effectiveRates({
      rates: { pushup: 2, 'pull.pullups': -1, unknown: 5 },
    });

    // then
    expect(rates['pushup']).toBe(2);
    expect(rates['pull.pullups']).toBe(DEFAULT_XP_RATES['pull.pullups']);
    expect(rates['unknown']).toBeUndefined();
  });

  it('should return the defaults without a config', () => {
    // then
    expect(effectiveRates(null)).toEqual(DEFAULT_XP_RATES);
  });
});

describe('overridesFrom', () => {
  it('should keep only rates that differ from the default', () => {
    // given
    const rates = { ...DEFAULT_XP_RATES, pushup: 1.5 };

    // when
    const overrides = overridesFrom(rates);

    // then
    expect(overrides).toEqual({ pushup: 1.5 });
  });

  it('should drop unknown ids and invalid rates', () => {
    // when
    const overrides = overridesFrom({ ghost: 3, pushup: Number.NaN });

    // then
    expect(overrides).toEqual({});
  });
});

describe('parseXpRateInput', () => {
  it.each([
    ['2', 2],
    ['0,5', 0.5],
    [' 0 ', 0],
  ])('should parse %j', (raw, expected) => {
    // then
    expect(parseXpRateInput(raw)).toBe(expected);
  });

  it.each(['', '-1', 'abc', '1001'])('should reject %j', (raw) => {
    // then
    expect(parseXpRateInput(raw)).toBeNull();
  });
});

describe('sameRates', () => {
  it('should compare rate maps by value', () => {
    // then
    expect(sameRates({ a: 1 }, { a: 1 })).toBe(true);
    expect(sameRates({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameRates({ a: 1 }, {})).toBe(false);
  });
});
