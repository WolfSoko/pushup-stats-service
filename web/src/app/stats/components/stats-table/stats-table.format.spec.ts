import { UnifiedEntry } from '@pu-stats/models';
import {
  buildDisplayedColumns,
  exerciseLabel,
  exerciseWikiLink,
  formatDuration,
  formatEntry,
  formatSets,
  sortingValue,
  sortValue,
  spansMultipleExercises,
  typeLabel,
} from './stats-table.format';

function entry(overrides: Partial<UnifiedEntry> = {}): UnifiedEntry {
  return {
    kind: 'exercise',
    _id: '1',
    exerciseId: 'pushup',
    timestamp: '2026-02-10T10:00:00',
    reps: 10,
    source: 'web',
    ...overrides,
  } as UnifiedEntry;
}

describe('formatSets', () => {
  it('should return "count×reps" for uniform sets', () => {
    // given
    const sets = [10, 10, 10];
    // when
    const result = formatSets(sets);
    // then
    expect(result).toBe('3×10');
  });

  it('should join mixed sets with " + "', () => {
    // given
    const sets = [10, 15, 5];
    // when
    const result = formatSets(sets);
    // then
    expect(result).toBe('10 + 15 + 5');
  });

  it('should return an empty string for an empty array', () => {
    // given / when
    const result = formatSets([]);
    // then
    expect(result).toBe('');
  });

  it('should return an empty string for a nullish input', () => {
    // given / when
    const result = formatSets(undefined as unknown as number[]);
    // then
    expect(result).toBe('');
  });
});

describe('spansMultipleExercises', () => {
  it('should be false for an empty row set', () => {
    // given / when / then
    expect(spansMultipleExercises([])).toBe(false);
  });

  it('should be false when every row maps to the same filter key', () => {
    // given — pushup variants all collapse to one filter key
    const rows = [
      entry({ exerciseId: 'pushup', variantId: 'diamond' }),
      entry({ exerciseId: 'pushup', variantId: 'wide' }),
    ];
    // when / then
    expect(spansMultipleExercises(rows)).toBe(false);
  });

  it('should be true when rows span distinct exercises', () => {
    // given
    const rows = [
      entry({ exerciseId: 'pushup' }),
      entry({ exerciseId: 'abs.situps' }),
    ];
    // when / then
    expect(spansMultipleExercises(rows)).toBe(true);
  });
});

describe('buildDisplayedColumns', () => {
  it('should include exercise, source and actions when all flags are set', () => {
    // given / when
    const cols = buildDisplayedColumns({
      showExercise: true,
      showSource: true,
      readOnly: false,
    });
    // then
    expect(cols).toEqual([
      'timestamp',
      'reps',
      'exercise',
      'type',
      'source',
      'actions',
    ]);
  });

  it('should omit exercise/source and actions in the minimal read-only case', () => {
    // given / when
    const cols = buildDisplayedColumns({
      showExercise: false,
      showSource: false,
      readOnly: true,
    });
    // then
    expect(cols).toEqual(['timestamp', 'reps', 'type']);
  });
});

describe('exerciseLabel', () => {
  it('should label pushup rows with the localized pushup category', () => {
    // given
    const row = entry({ exerciseId: 'pushup' });
    // when / then
    expect(exerciseLabel(row)).toBe('Liegestütze');
  });

  it('should fall back to the raw id for an unknown catalog exercise', () => {
    // given
    const row = entry({ exerciseId: 'made.up.exercise' });
    // when / then
    expect(exerciseLabel(row)).toBe('made.up.exercise');
  });
});

describe('exerciseWikiLink', () => {
  it('should drill into the pushup wiki detail for a known variant', () => {
    // given
    const row = entry({ exerciseId: 'pushup', variantId: 'diamond' });
    // when
    const link = exerciseWikiLink(row);
    // then
    expect(link[0]).toBe('/wiki/liegestuetz-typen');
    expect(link.length).toBe(2);
  });

  it('should fall back to the pushup wiki list for an unknown variant', () => {
    // given
    const row = entry({ exerciseId: 'pushup', variantId: undefined });
    // when / then
    expect(exerciseWikiLink(row)).toEqual(['/wiki/liegestuetz-typen']);
  });

  it('should route a catalog exercise to its /wiki/uebungen detail', () => {
    // given
    const row = entry({ exerciseId: 'abs.situps' });
    // when / then
    expect(exerciseWikiLink(row)).toEqual(['/wiki/uebungen', 'sit-ups']);
  });

  it('should fall back to the /wiki/uebungen list for an unknown catalog id', () => {
    // given
    const row = entry({ exerciseId: 'made.up.exercise' });
    // when / then
    expect(exerciseWikiLink(row)).toEqual(['/wiki/uebungen']);
  });
});

describe('typeLabel', () => {
  it('should return the variant id for a non-pushup exercise', () => {
    // given
    const row = entry({ exerciseId: 'abs.situps', variantId: 'weighted' });
    // when / then
    expect(typeLabel(row, 'de')).toBe('weighted');
  });

  it('should return an empty string when a non-pushup row has no variant', () => {
    // given
    const row = entry({ exerciseId: 'abs.situps', variantId: undefined });
    // when / then
    expect(typeLabel(row, 'de')).toBe('');
  });
});

describe('formatEntry', () => {
  it('should stringify reps when the catalog id is unknown', () => {
    // given
    const row = entry({ exerciseId: 'made.up.exercise', reps: 42 });
    // when / then
    expect(formatEntry(row)).toBe('42');
  });
});

describe('sortValue', () => {
  it('should fall back to reps when the catalog id is unknown', () => {
    // given
    const row = entry({ exerciseId: 'made.up.exercise', reps: 7 });
    // when / then
    expect(sortValue(row)).toBe(7);
  });

  it('should use the primary measurement field for a duration exercise', () => {
    // given — plank measures time; durationSec drives the sort key
    const row = entry({
      exerciseId: 'plank.standard',
      reps: 0,
      durationSec: 90,
    });
    // when / then
    expect(sortValue(row)).toBe(90);
  });
});

describe('sortingValue', () => {
  it('should sort the timestamp column by epoch millis', () => {
    // given
    const row = entry({ timestamp: '2026-02-10T10:00:00' });
    // when
    const result = sortingValue(row, 'timestamp', 'de');
    // then
    expect(result).toBe(new Date('2026-02-10T10:00:00').getTime());
  });

  it('should delegate the reps column to the measurement-aware sort key', () => {
    // given
    const row = entry({ exerciseId: 'made.up.exercise', reps: 5 });
    // when / then
    expect(sortingValue(row, 'reps', 'de')).toBe(5);
  });

  it('should sort the source column by the raw source string', () => {
    // given
    const row = entry({ source: 'manual' });
    // when / then
    expect(sortingValue(row, 'source', 'de')).toBe('manual');
  });

  it('should sort the type column by the type label', () => {
    // given
    const row = entry({ exerciseId: 'abs.situps', variantId: 'weighted' });
    // when / then
    expect(sortingValue(row, 'type', 'de')).toBe('weighted');
  });

  it('should sort the exercise column by the exercise label', () => {
    // given
    const row = entry({ exerciseId: 'pushup' });
    // when / then
    expect(sortingValue(row, 'exercise', 'de')).toBe('Liegestütze');
  });

  it('should return an empty string for an unknown column', () => {
    // given / when / then
    expect(sortingValue(entry(), 'mystery', 'de')).toBe('');
  });
});

describe('formatDuration', () => {
  it('should delegate to the unit-aware seconds formatter', () => {
    // given / when
    const result = formatDuration(90);
    // then — non-empty formatted string, not the raw number
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
