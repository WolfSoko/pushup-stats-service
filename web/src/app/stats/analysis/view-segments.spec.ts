import type { UnifiedEntry } from '@pu-stats/models';
import {
  buildAnalysisSegments,
  type AnalysisSegmentInput,
} from './view-segments';

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

function input(
  overrides: Partial<AnalysisSegmentInput> = {}
): AnalysisSegmentInput {
  return {
    rangeRows: [],
    weekRows: [],
    monthRows: [],
    monday: new Date(2026, 5, 15),
    monthStart: new Date(2026, 5, 1),
    chart: { from: '2026-06-15', isDayRange: false, dayChartMode: '14h' },
    breakdown: { view: 'core', kinds: [], locale: 'en' },
    exerciseOrder: [],
    ...overrides,
  };
}

const situps = entry({
  exerciseId: 'abs.situps',
  reps: 30,
  timestamp: '2026-06-15T10:00:00',
});
const plank = entry({
  exerciseId: 'plank.standard',
  durationSec: 90,
  timestamp: '2026-06-15T11:00:00',
});

describe('buildAnalysisSegments', () => {
  it('should split a mixed category into one block per measurement', () => {
    // given
    const rows = [situps, plank];
    // when
    const segments = buildAnalysisSegments(
      input({ rangeRows: rows, weekRows: rows, monthRows: rows })
    );
    // then
    expect(segments.map((s) => s.measurement)).toEqual(['reps', 'time']);
    expect(segments[0].series[0].total).toBe(30);
    expect(segments[1].series[0].total).toBe(90);
  });

  it('should keep best values in each block on that block’s own dimension', () => {
    // given
    const rows = [situps, plank];
    // when
    const [reps, time] = buildAnalysisSegments(input({ rangeRows: rows }));
    // then — the plank used to land in a reps KPI as 0
    expect(reps.bestEntry?.value).toBe(30);
    expect(reps.bestDay).toEqual({ date: '2026-06-15', total: 30 });
    expect(time.bestEntry?.value).toBe(90);
    expect(time.bestDay).toEqual({ date: '2026-06-15', total: 90 });
  });

  it('should roll up trends per measurement instead of summing reps and seconds', () => {
    // given
    const rows = [situps, plank];
    // when
    const [reps, time] = buildAnalysisSegments(
      input({ rangeRows: rows, weekRows: rows, monthRows: rows })
    );
    // then — trends run newest-first, so the seeded week/month leads
    expect(reps.weekTrend[0].total).toBe(30);
    expect(time.weekTrend[0].total).toBe(90);
    expect(reps.monthTrend[0].total).toBe(30);
    expect(time.monthTrend[0].total).toBe(90);
  });

  it('should give a measurement present only in the trend window a block without range data', () => {
    // given the filter excludes the plank, but the 8-week window still holds it
    // when
    const segments = buildAnalysisSegments(
      input({ rangeRows: [situps], weekRows: [situps, plank] })
    );
    // then the trends stay visible while the chart/KPI part is skipped
    const time = segments.find((s) => s.measurement === 'time');
    expect(time?.hasRangeRows).toBe(false);
    expect(time?.series).toEqual([]);
    expect(time?.weekTrend[0].total).toBe(90);
    expect(segments.find((s) => s.measurement === 'reps')?.hasRangeRows).toBe(
      true
    );
  });

  it('should scope sets stats to the block that can have sets', () => {
    // given
    const rows = [
      entry({
        exerciseId: 'abs.situps',
        reps: 30,
        sets: [10, 20],
        timestamp: '2026-06-15T10:00:00',
      }),
      plank,
    ];
    // when
    const [reps, time] = buildAnalysisSegments(input({ rangeRows: rows }));
    // then
    expect(reps.avgSetSize).toBe(15);
    expect(reps.bestSingleSet).toBe(20);
    expect(time.avgSetSize).toBe(0);
    expect(time.setsDistribution).toEqual([]);
  });

  it('should value the type breakdown of a time block in seconds', () => {
    // given
    const rows = [plank, situps];
    // when
    const time = buildAnalysisSegments(input({ rangeRows: rows })).find(
      (s) => s.measurement === 'time'
    );
    // then
    expect(time?.typeBreakdown).toEqual([
      {
        id: 'plank.standard',
        label: 'plank.standard',
        value: 90,
        avgSetSize: 0,
      },
    ]);
  });

  it('should return no segments when neither the range nor a trend window has rows', () => {
    // given / when / then
    expect(buildAnalysisSegments(input())).toEqual([]);
  });
});
