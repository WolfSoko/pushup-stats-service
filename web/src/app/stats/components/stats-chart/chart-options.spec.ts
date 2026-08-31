import { StatsGranularity } from '@pu-stats/models';
import { buildChartOptions, ChartOptionsInputs } from './chart-options';

function optionsFor(
  overrides: Partial<ChartOptionsInputs> = {}
): ReturnType<typeof buildChartOptions> {
  return buildChartOptions({
    granularity: 'daily',
    rangeMode: 'week',
    measurement: 'reps',
    dayChartMode: '14h',
    from: '2026-02-09',
    to: '2026-02-15',
    hasSetsData: false,
    stackedBreakdown: false,
    paceMode: false,
    bucketLabelByTs: new Map(),
    setsByBucket: new Map(),
    colors: {
      chartTick: '#000',
      chartGrid: '#111',
      chartGridLight: '#222',
      tooltipBg: '#333',
      tooltipTitle: '#444',
      tooltipBody: '#555',
      tooltipBorder: '#666',
    },
    localeId: 'de-DE',
    setsTooltipLabel: 'Sets',
    weekAbbrev: 'KW',
    yAxisTitle: 'Reps',
    ySecondaryAxisTitle: 'Σ Reps',
    ...overrides,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xScale(options: ReturnType<typeof buildChartOptions>): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (options as any).scales.x;
}

function tooltipTitleFor(
  granularity: StatsGranularity,
  bucket: Date,
  overrides: Partial<ChartOptionsInputs> = {}
): string {
  const options = optionsFor({ granularity, ...overrides });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callbacks = (options as any).plugins.tooltip.callbacks;
  return callbacks.title([{ parsed: { x: bucket.getTime() } }]);
}

describe('buildChartOptions x-axis unit', () => {
  it('should map each granularity onto the matching Chart.js time unit', () => {
    // given / when / then
    expect(xScale(optionsFor({ granularity: 'hourly' })).time.unit).toBe(
      'hour'
    );
    expect(xScale(optionsFor({ granularity: 'daily' })).time.unit).toBe('day');
    expect(xScale(optionsFor({ granularity: 'weekly' })).time.unit).toBe(
      'week'
    );
    expect(xScale(optionsFor({ granularity: 'monthly' })).time.unit).toBe(
      'month'
    );
  });
});

describe('buildChartOptions weekly tick alignment', () => {
  it('should anchor the week gridlines on Mondays, matching the bars', () => {
    // given / when — Chart.js defaults week ticks to Sundays
    const scale = xScale(optionsFor({ granularity: 'weekly' }));
    // then
    expect(scale.time.isoWeekday).toBe(true);
  });

  it('should leave other granularities on the default weekday', () => {
    // given / when / then
    expect(xScale(optionsFor({ granularity: 'daily' })).time.isoWeekday).toBe(
      false
    );
  });
});

describe('buildChartOptions weekly tick labels', () => {
  it('should label a weekly bucket with its ISO week number', () => {
    // given — the Monday opening ISO week 25 of 2026
    const scale = xScale(
      optionsFor({
        granularity: 'weekly',
        rangeMode: 'month',
        from: '2026-06-01',
        to: '2026-06-30',
      })
    );
    // when
    const tick = scale.ticks.callback(new Date(2026, 5, 15).getTime());
    // then — the Monday's date alone would read as a single day
    expect(tick).toBe('KW 25');
  });
});

describe('buildChartOptions monthly tick labels', () => {
  function tickFor(from: string, to: string): string {
    const scale = xScale(
      optionsFor({ granularity: 'monthly', rangeMode: 'custom', from, to })
    );
    return scale.ticks.callback(new Date(2026, 0, 1).getTime());
  }

  it('should label a monthly bucket with the month name', () => {
    // given / when
    const tick = tickFor('2026-01-01', '2026-12-31');
    // then
    expect(tick).toBe('Jan');
  });

  it('should print bare month names inside a single calendar year', () => {
    // given / when
    const tick = tickFor('2026-01-01', '2026-12-31');
    // then
    expect(tick).toBe('Jan');
  });

  it('should add the year once a custom span crosses into another one', () => {
    // given / when — without it "Okt Nov Dez Jan" hides where the year turns
    const tick = tickFor('2025-10-01', '2026-06-30');
    // then
    expect(tick).toContain('26');
  });
});

describe('buildChartOptions x-axis bounds', () => {
  it('should widen a weekly axis to whole ISO weeks so partial weeks stay drawn', () => {
    // given — July 2026 opens on a Wednesday and closes on a Friday
    const scale = xScale(
      optionsFor({
        granularity: 'weekly',
        rangeMode: 'month',
        from: '2026-07-01',
        to: '2026-07-31',
      })
    );
    // then
    expect(scale.min).toBe(new Date(2026, 5, 29).getTime());
    expect(scale.max).toBe(new Date(2026, 7, 2, 23, 59, 59).getTime());
  });

  it('should leave a single-day range unbounded so the hour bars auto-scale', () => {
    // given / when
    const scale = xScale(
      optionsFor({
        granularity: 'hourly',
        rangeMode: 'day',
        from: '2026-02-12',
        to: '2026-02-12',
      })
    );
    // then
    expect(scale.min).toBeUndefined();
    expect(scale.max).toBeUndefined();
  });
});

describe('buildChartOptions tooltip titles', () => {
  it('should name a weekly bucket by the Monday-to-Sunday span it covers', () => {
    // given / when — the ISO week opening on 15 June 2026, fully inside
    // the filter range
    const title = tooltipTitleFor('weekly', new Date(2026, 5, 15), {
      rangeMode: 'month',
      from: '2026-06-01',
      to: '2026-06-30',
    });
    // then — the week number ties the tooltip back to its "KW 25" tick
    expect(title).toContain('KW 25');
    expect(title).toContain('15.06');
    expect(title).toContain('21.06');
  });

  it('should clip a weekly title to the filter range at the range edge', () => {
    // given — February 2026 opens on a Sunday, so its first weekly bar
    // holds a single in-range day; naming the whole week would
    // overstate what the bar counts.
    const title = tooltipTitleFor('weekly', new Date(2026, 0, 26), {
      rangeMode: 'month',
      from: '2026-02-01',
      to: '2026-02-28',
    });
    // then
    expect(title).toContain('01.02.2026');
    expect(title).not.toContain('26.01');
  });

  it('should name a monthly bucket by its month and year', () => {
    // given / when
    const title = tooltipTitleFor('monthly', new Date(2026, 5, 1));
    // then
    expect(title).toBe('Juni 2026');
  });

  it('should keep the weekday-dated title for daily buckets', () => {
    // given / when
    const title = tooltipTitleFor('daily', new Date(2026, 1, 12));
    // then
    expect(title).toContain('12.02.2026');
  });
});

describe('buildChartOptions axis titles', () => {
  it('should title both y axes with their unit', () => {
    // given / when
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scales = (optionsFor() as any).scales;
    // then
    expect(scales.y.title).toMatchObject({ display: true, text: 'Reps' });
    expect(scales.yIntegral.title).toMatchObject({
      display: true,
      text: 'Σ Reps',
    });
  });

  it('should hide the axis titles when no single unit describes the view', () => {
    // given / when — a mixed view passes empty unit strings
    const scales = (
      optionsFor({
        yAxisTitle: '',
        ySecondaryAxisTitle: '',
      }) as any
    ).scales;
    // then
    expect(scales.y.title.display).toBe(false);
    expect(scales.yIntegral.title.display).toBe(false);
  });
});
