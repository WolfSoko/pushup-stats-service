import type { UnifiedEntry } from '@pu-stats/models';
import {
  buildTeaserAllSeries,
  buildTeaserExerciseTabs,
} from './analysis-teaser-tabs';

function entry(
  overrides: Partial<UnifiedEntry> & { exerciseId: string; timestamp: string }
): UnifiedEntry {
  return {
    kind: 'exercise',
    _id: `${overrides.exerciseId}-${overrides.timestamp}`,
    reps: 0,
    source: 'web',
    ...overrides,
  };
}

describe('buildTeaserAllSeries', () => {
  it('should sum reps per day across all exercises', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-04-06T08:00:00',
        reps: 10,
      }),
      entry({
        exerciseId: 'abs.situps',
        timestamp: '2026-04-06T12:00:00',
        reps: 5,
      }),
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-04-08T09:00:00',
        reps: 20,
      }),
    ];

    // when
    const series = buildTeaserAllSeries(rows);

    // then
    expect(series).toEqual([
      { bucket: '2026-04-06', total: 15, dayIntegral: 15 },
      { bucket: '2026-04-08', total: 20, dayIntegral: 35 },
    ]);
  });

  it('should skip entries without reps (duration/distance-only)', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'plank.standard',
        timestamp: '2026-04-07T10:00:00',
        durationSec: 90,
      }),
    ];

    // when
    const series = buildTeaserAllSeries(rows);

    // then
    expect(series).toEqual([]);
  });
});

describe('buildTeaserExerciseTabs', () => {
  it('should create one tab per distinct exercise in the rows', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-04-06T08:00:00',
        reps: 10,
      }),
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-04-07T08:00:00',
        reps: 12,
      }),
      entry({
        exerciseId: 'plank.standard',
        timestamp: '2026-04-07T10:00:00',
        durationSec: 60,
      }),
    ];

    // when
    const tabs = buildTeaserExerciseTabs(rows);

    // then
    expect(tabs.map((t) => t.id)).toEqual(['pushup', 'plank.standard']);
  });

  it('should order tabs by catalog position with unknown ids last', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'cardio.running',
        timestamp: '2026-04-06T08:00:00',
        distanceM: 5000,
        durationSec: 1500,
      }),
      entry({
        exerciseId: 'custom-uuid-42',
        timestamp: '2026-04-06T09:00:00',
        reps: 8,
      }),
      entry({
        exerciseId: 'plank.standard',
        timestamp: '2026-04-06T10:00:00',
        durationSec: 60,
      }),
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-04-06T11:00:00',
        reps: 10,
      }),
    ];

    // when
    const tabs = buildTeaserExerciseTabs(rows);

    // then
    expect(tabs.map((t) => t.id)).toEqual([
      'pushup',
      'plank.standard',
      'cardio.running',
      'custom-uuid-42',
    ]);
  });

  it('should use the localised display name as tab label and the raw id for catalog misses', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-04-06T08:00:00',
        reps: 10,
      }),
      entry({
        exerciseId: 'custom-uuid-42',
        timestamp: '2026-04-06T09:00:00',
        reps: 8,
      }),
    ];

    // when
    const tabs = buildTeaserExerciseTabs(rows);

    // then
    expect(tabs[0].label).toBe('Liegestütze');
    expect(tabs[1].label).toBe('custom-uuid-42');
  });

  it('should chart a time-measured exercise on its duration', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'plank.standard',
        timestamp: '2026-04-07T10:00:00',
        durationSec: 60,
      }),
      entry({
        exerciseId: 'plank.standard',
        timestamp: '2026-04-07T18:00:00',
        durationSec: 30,
      }),
    ];

    // when
    const [tab] = buildTeaserExerciseTabs(rows);

    // then
    expect(tab.measurement).toBe('time');
    expect(tab.series).toEqual([
      { bucket: '2026-04-07', total: 90, dayIntegral: 90 },
    ]);
  });

  it('should chart a distance-time exercise in km with a pace series', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'cardio.running',
        timestamp: '2026-04-06T08:00:00',
        distanceM: 5000,
        durationSec: 1500,
      }),
    ];

    // when
    const [tab] = buildTeaserExerciseTabs(rows);

    // then
    expect(tab.measurement).toBe('distance-time');
    expect(tab.series).toEqual([
      { bucket: '2026-04-06', total: 5, dayIntegral: 5 },
    ]);
    // 1500 s over 5 km → 5 min/km
    expect(tab.paceSeries).toEqual([{ bucket: '2026-04-06', pace: 5 }]);
  });

  it('should keep per-exercise series independent of other exercises', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'pushup',
        timestamp: '2026-04-06T08:00:00',
        reps: 10,
      }),
      entry({
        exerciseId: 'abs.situps',
        timestamp: '2026-04-06T09:00:00',
        reps: 25,
      }),
    ];

    // when
    const tabs = buildTeaserExerciseTabs(rows);

    // then
    const pushupTab = tabs.find((t) => t.id === 'pushup');
    const situpsTab = tabs.find((t) => t.id === 'abs.situps');
    expect(pushupTab?.series).toEqual([
      { bucket: '2026-04-06', total: 10, dayIntegral: 10 },
    ]);
    expect(situpsTab?.series).toEqual([
      { bucket: '2026-04-06', total: 25, dayIntegral: 25 },
    ]);
  });

  it('should return no tabs for empty rows', () => {
    // given / when
    const tabs = buildTeaserExerciseTabs([]);

    // then
    expect(tabs).toEqual([]);
  });
});
