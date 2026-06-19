import { UnifiedEntry } from '@pu-stats/models';
import {
  ExerciseEntryDialogResult,
  PushupEntryDialogResult,
} from '../training-entry-dialog/training-entry-dialog.models';
import {
  toCreatePayload,
  toEditDialogData,
  toUpdatePayload,
} from './stats-table.payloads';

function pushupResult(
  overrides: Partial<PushupEntryDialogResult> = {}
): PushupEntryDialogResult {
  return {
    kind: 'pushup',
    timestamp: '2026-02-10T10:00+01:00',
    reps: 20,
    sets: [20],
    source: 'web',
    type: 'standard',
    ...overrides,
  };
}

function exerciseResult(
  overrides: Partial<ExerciseEntryDialogResult> = {}
): ExerciseEntryDialogResult {
  return {
    kind: 'exercise',
    timestamp: '2026-02-10T10:00+01:00',
    exerciseId: 'abs.situps',
    measurement: 'reps',
    reps: 30,
    sets: [],
    intervals: [],
    ...overrides,
  };
}

function entry(overrides: Partial<UnifiedEntry> = {}): UnifiedEntry {
  return {
    kind: 'exercise',
    _id: 'e1',
    exerciseId: 'abs.situps',
    timestamp: '2026-02-10T09:00:00',
    reps: 25,
    source: 'web',
    ...overrides,
  } as UnifiedEntry;
}

describe('toCreatePayload', () => {
  it('should build a single-set pushup create payload without a sets field', () => {
    // given
    const result = pushupResult({ reps: 15, sets: [15] });
    // when
    const payload = toCreatePayload(result);
    // then
    expect(payload).toEqual({
      kind: 'pushup',
      timestamp: '2026-02-10T10:00+01:00',
      reps: 15,
      source: 'web',
      type: 'standard',
    });
    expect('sets' in payload).toBe(false);
  });

  it('should keep the sets breakdown for a multi-set pushup create', () => {
    // given
    const result = pushupResult({ reps: 30, sets: [10, 10, 10] });
    // when
    const payload = toCreatePayload(result);
    // then
    expect(payload.sets).toEqual([10, 10, 10]);
  });

  it('should build a reps exercise create with multi-set breakdown', () => {
    // given
    const result = exerciseResult({ measurement: 'reps', sets: [12, 12, 6] });
    // when
    const payload = toCreatePayload(result);
    // then
    expect(payload).toMatchObject({
      kind: 'exercise',
      exerciseId: 'abs.situps',
      reps: 30,
      sets: [12, 12, 6],
    });
  });

  it('should build a time exercise create with intervals', () => {
    // given
    const result = exerciseResult({
      measurement: 'time',
      durationSec: 120,
      intervals: [60, 60],
    });
    // when
    const payload = toCreatePayload(result);
    // then
    expect(payload).toMatchObject({
      kind: 'exercise',
      durationSec: 120,
      intervals: [60, 60],
    });
    expect('reps' in payload).toBe(false);
  });

  it('should build a distance-time exercise create with both fields', () => {
    // given
    const result = exerciseResult({
      measurement: 'distance-time',
      distanceM: 5000,
      durationSec: 1500,
      intervals: [],
    });
    // when
    const payload = toCreatePayload(result);
    // then
    expect(payload).toMatchObject({ distanceM: 5000, durationSec: 1500 });
    expect('intervals' in payload).toBe(false);
  });

  it('should build a pure-distance exercise create', () => {
    // given
    const result = exerciseResult({
      measurement: 'distance',
      distanceM: 1000,
      intervals: [500, 500],
    });
    // when
    const payload = toCreatePayload(result);
    // then
    expect(payload).toMatchObject({ distanceM: 1000, intervals: [500, 500] });
    expect('durationSec' in payload).toBe(false);
  });

  it('should forward a variantId when present', () => {
    // given
    const result = exerciseResult({ variantId: 'weighted' });
    // when / then
    expect(toCreatePayload(result).variantId).toBe('weighted');
  });

  it('should omit durationSec/distanceM defaults to 0 when missing', () => {
    // given — measurement time but no durationSec supplied
    const result = exerciseResult({
      measurement: 'time',
      durationSec: undefined,
    });
    // when / then
    expect(toCreatePayload(result).durationSec).toBe(0);
  });
});

describe('toUpdatePayload', () => {
  it('should build a pushup update collapsing stale sets to the clear sentinel', () => {
    // given — original carried multi-set, edit drops to single set
    const row = entry({ exerciseId: 'pushup', sets: [10, 10] });
    const result = pushupResult({ reps: 18, sets: [18] });
    // when
    const payload = toUpdatePayload(row, result);
    // then — empty array signals deleteField()
    expect(payload).toMatchObject({ kind: 'pushup', id: 'e1', reps: 18 });
    expect(payload.sets).toEqual([]);
  });

  it('should leave sets undefined when the original had none', () => {
    // given
    const row = entry({ exerciseId: 'pushup', sets: undefined });
    const result = pushupResult({ reps: 18, sets: [18] });
    // when / then
    expect(toUpdatePayload(row, result).sets).toBeUndefined();
  });

  it('should clear a stale intervals breakdown on a time update', () => {
    // given
    const row = entry({ exerciseId: 'plank.standard', intervals: [30, 30] });
    const result = exerciseResult({
      measurement: 'time',
      durationSec: 90,
      intervals: [],
    });
    // when
    const payload = toUpdatePayload(row, result);
    // then
    expect(payload.durationSec).toBe(90);
    expect(payload.intervals).toEqual([]);
  });

  it('should omit intervals when neither result nor entry carried one', () => {
    // given
    const row = entry({ exerciseId: 'plank.standard', intervals: undefined });
    const result = exerciseResult({
      measurement: 'time',
      durationSec: 90,
      intervals: [],
    });
    // when / then
    expect('intervals' in toUpdatePayload(row, result)).toBe(false);
  });

  it('should preserve the entry source rather than the dialog source', () => {
    // given
    const row = entry({ exerciseId: 'abs.situps', source: 'import' });
    const result = exerciseResult({ measurement: 'reps' });
    // when / then
    expect(toUpdatePayload(row, result).source).toBe('import');
  });

  it('should throw on a kind mismatch between entry and result', () => {
    // given — pushup row but exercise result
    const row = entry({ exerciseId: 'pushup' });
    const result = exerciseResult({ measurement: 'reps' });
    // when / then
    expect(() => toUpdatePayload(row, result)).toThrow(/kind mismatch/);
  });
});

describe('toEditDialogData', () => {
  it('should map a pushup row to pushup dialog data with variant as type', () => {
    // given
    const row = entry({
      exerciseId: 'pushup',
      reps: 12,
      sets: [12],
      variantId: 'diamond',
    });
    // when
    const data = toEditDialogData(row);
    // then
    expect(data).toMatchObject({
      kind: 'pushup',
      reps: 12,
      sets: [12],
      type: 'diamond',
    });
  });

  it('should default a pushup row type to undefined when no variant is set', () => {
    // given
    const row = entry({ exerciseId: 'pushup', variantId: undefined });
    // when
    const data = toEditDialogData(row);
    // then
    expect(data.kind).toBe('pushup');
    if (data.kind === 'pushup') {
      expect(data.type).toBeUndefined();
    }
  });

  it('should map a catalog exercise row including durationSec when present', () => {
    // given
    const row = entry({
      exerciseId: 'plank.standard',
      durationSec: 60,
    });
    // when
    const data = toEditDialogData(row);
    // then
    expect(data).toMatchObject({
      kind: 'exercise',
      exerciseId: 'plank.standard',
      durationSec: 60,
    });
  });

  it('should omit durationSec/distanceM when the row lacks them', () => {
    // given
    const row = entry({ exerciseId: 'abs.situps' });
    // when
    const data = toEditDialogData(row);
    // then
    expect('durationSec' in data).toBe(false);
    expect('distanceM' in data).toBe(false);
  });
});
