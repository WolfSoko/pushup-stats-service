import type { ExerciseDefinition, UnifiedEntry } from '@pu-stats/models';
import { groupRowsByMeasurement, SEGMENT_ORDER } from './measurement-groups';

function entry(
  partial: Partial<UnifiedEntry> & { exerciseId: string }
): UnifiedEntry {
  return {
    kind: 'exercise',
    _id: Math.random().toString(36).slice(2),
    timestamp: '2026-06-15T10:00:00',
    reps: 0,
    source: 'test',
    ...partial,
  };
}

describe('groupRowsByMeasurement', () => {
  it('should bucket rows by their catalog measurement', () => {
    // given
    const rows = [
      entry({ exerciseId: 'pushup', reps: 20 }),
      entry({ exerciseId: 'plank.standard', durationSec: 60 }),
      entry({ exerciseId: 'abs.situps', reps: 30 }),
    ];
    // when
    const grouped = groupRowsByMeasurement(rows);
    // then
    expect(grouped.get('reps')).toHaveLength(2);
    expect(grouped.get('time')).toHaveLength(1);
  });

  it('should bucket rows the resolver cannot classify as mixed', () => {
    // given
    const rows = [entry({ exerciseId: 'deleted.custom', reps: 5 })];
    // when
    const grouped = groupRowsByMeasurement(rows);
    // then
    expect(grouped.get('mixed')).toHaveLength(1);
  });

  it('should honour a custom resolver for user-defined exercises', () => {
    // given
    const custom = {
      id: 'custom.hold',
      categoryId: 'core',
      ownerId: 'u1',
      measurement: 'time',
      min: 1,
      max: 600,
      unit: 'sec',
      customName: 'Custom Hold',
    } as ExerciseDefinition;
    const rows = [entry({ exerciseId: 'custom.hold', durationSec: 45 })];
    // when
    const grouped = groupRowsByMeasurement(rows, (id) =>
      id === custom.id ? custom : null
    );
    // then
    expect(grouped.get('time')).toHaveLength(1);
    expect(grouped.has('mixed')).toBe(false);
  });

  it('should keep the unresolvable bucket last in the render order', () => {
    // given / when / then
    expect(SEGMENT_ORDER[0]).toBe('reps');
    expect(SEGMENT_ORDER[SEGMENT_ORDER.length - 1]).toBe('mixed');
  });
});
