import { StatsGranularity } from '@pu-stats/models';
import { ChartConfiguration, TooltipItem } from 'chart.js';
import { BucketSetsInfo, ChartMeasurement } from './stats-chart.models';
import {
  axisBoundsForRange,
  barAxisPrecision,
  bucketToTs,
  formatCustomHourBlock,
  formatHourLabel,
} from './chart-helpers';

export interface ChartThemeColors {
  chartTick: string;
  chartGrid: string;
  chartGridLight: string;
  tooltipBg: string;
  tooltipTitle: string;
  tooltipBody: string;
  tooltipBorder: string;
}

export interface ChartOptionsInputs {
  granularity: StatsGranularity;
  rangeMode: 'day' | 'week' | 'month' | 'year' | 'custom';
  measurement: ChartMeasurement;
  dayChartMode: '24h' | '14h';
  from: string | null;
  to: string | null;
  hasSetsData: boolean;
  /** True while per-exercise bars are drawn as one stack per bucket. */
  stackedBreakdown: boolean;
  paceMode: boolean;
  bucketLabelByTs: Map<number, string>;
  setsByBucket: Map<number, BucketSetsInfo>;
  colors: ChartThemeColors;
  localeId: string;
  setsTooltipLabel: string;
  /** Unit of the bar values, e.g. `'km'`; `''` hides the axis title. */
  yAxisTitle: string;
  /** Unit of the right-hand line, e.g. `'min/km'`; `''` hides it. */
  ySecondaryAxisTitle: string;
}

const TIME_UNIT: Record<StatsGranularity, 'hour' | 'day' | 'week' | 'month'> = {
  hourly: 'hour',
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
};

/**
 * Month ticks carry a year as soon as the range can hold two of them —
 * a custom span of 2025-10 to 2026-06 would otherwise print "Okt Nov
 * Dez Jan" with nothing saying where the year turns, and a two-year
 * span would repeat every month label.
 */
function tickFormatOptions(
  granularity: StatsGranularity,
  spansMultipleYears: boolean
): Intl.DateTimeFormatOptions {
  if (granularity !== 'monthly') return { day: '2-digit', month: '2-digit' };
  return spansMultipleYears
    ? { month: 'short', year: '2-digit' }
    : { month: 'short' };
}

export function readThemeColors(): ChartThemeColors {
  const cs = getComputedStyle(document.documentElement);
  return {
    chartTick: cs.getPropertyValue('--chart-tick').trim() || '#c8d3ea',
    chartGrid:
      cs.getPropertyValue('--chart-grid').trim() || 'rgba(116,140,190,0.2)',
    chartGridLight:
      cs.getPropertyValue('--chart-grid-light').trim() ||
      'rgba(116,140,190,0.15)',
    tooltipBg:
      cs.getPropertyValue('--tooltip-bg').trim() || 'rgba(14,20,35,0.95)',
    tooltipTitle: cs.getPropertyValue('--tooltip-title').trim() || '#eff4ff',
    tooltipBody: cs.getPropertyValue('--tooltip-body').trim() || '#dbe6ff',
    tooltipBorder:
      cs.getPropertyValue('--tooltip-border').trim() ||
      'rgba(125,154,219,0.35)',
  };
}

export function buildChartOptions(
  inputs: ChartOptionsInputs
): ChartConfiguration<'bar' | 'line'>['options'] {
  const {
    granularity,
    rangeMode,
    measurement,
    dayChartMode,
    from,
    to,
    hasSetsData,
    stackedBreakdown,
    paceMode,
    bucketLabelByTs,
    setsByBucket,
    colors,
    localeId,
    setsTooltipLabel,
    yAxisTitle,
    ySecondaryAxisTitle,
  } = inputs;

  const isCompactDayMode = granularity === 'hourly' && dayChartMode === '14h';

  const spansMultipleYears =
    !!from && !!to && from.slice(0, 4) !== to.slice(0, 4);
  const xTickFormatter = new Intl.DateTimeFormat(
    localeId,
    tickFormatOptions(granularity, spansMultipleYears)
  );
  const isGermanLocale = localeId.toLowerCase().startsWith('de');
  const tooltipTitleFormatter = new Intl.DateTimeFormat(
    localeId,
    granularity === 'hourly'
      ? {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }
      : granularity === 'monthly'
        ? { month: 'long', year: 'numeric' }
        : {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }
  );
  // A weekly bar covers Monday–Sunday; naming only its Monday would
  // read as a single day, so its tooltip spells the span out. The span
  // is clipped to the filter range: a month view's first and last weeks
  // reach outside it, and those days were filtered out of the bar's
  // total — claiming a full week would overstate what the bar holds.
  const weekStartFormatter = new Intl.DateTimeFormat(localeId, {
    day: '2-digit',
    month: '2-digit',
  });
  const formatBucketTitle = (ts: number): string => {
    const date = new Date(ts);
    if (granularity !== 'weekly') return tooltipTitleFormatter.format(date);
    const start = from ? Math.max(ts, bucketToTs(from)) : ts;
    const weekEnd = new Date(date);
    weekEnd.setDate(date.getDate() + 6);
    const end = to
      ? Math.min(weekEnd.getTime(), bucketToTs(to))
      : weekEnd.getTime();
    if (start === end) return tooltipTitleFormatter.format(new Date(start));
    return `${weekStartFormatter.format(new Date(start))} – ${tooltipTitleFormatter.format(new Date(end))}`;
  };

  const axisBounds = axisBoundsForRange(granularity, from, to);

  return {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    scales: {
      x: {
        type: 'time',
        stacked: hasSetsData || stackedBreakdown,
        min: rangeMode === 'day' ? undefined : axisBounds.min,
        max: rangeMode === 'day' ? undefined : axisBounds.max,
        time: {
          unit: TIME_UNIT[granularity],
          // Bars are keyed to ISO Mondays; without this Chart.js places
          // its week gridlines and labels on Sundays, one day left of
          // the bar each one describes.
          isoWeekday: granularity === 'weekly',
        },
        ticks: {
          color: colors.chartTick,
          maxRotation: 0,
          autoSkip: rangeMode !== 'day',
          maxTicksLimit: isCompactDayMode ? 15 : 12,
          callback: (value) => {
            const ts = Number(value);
            if (!Number.isFinite(ts)) return '';
            const custom = bucketLabelByTs.get(ts);
            if (custom) return formatCustomHourBlock(custom, isGermanLocale);
            if (granularity === 'hourly') {
              return formatHourLabel(new Date(ts), isGermanLocale);
            }
            return xTickFormatter.format(new Date(ts));
          },
        },
        grid: { color: colors.chartGridLight },
      },
      y: {
        stacked: hasSetsData || stackedBreakdown,
        title: {
          display: yAxisTitle.length > 0,
          text: yAxisTitle,
          color: colors.chartTick,
        },
        ticks: {
          color: colors.chartTick,
          // km bars use 1 decimal; reps/seconds stay integer.
          precision: barAxisPrecision(measurement),
        },
        grid: { color: colors.chartGrid },
      },
      yIntegral: {
        position: 'right',
        title: {
          display: ySecondaryAxisTitle.length > 0,
          text: ySecondaryAxisTitle,
          color: '#ffbe66',
        },
        ticks: {
          color: '#ffbe66',
          // Pace ticks render as decimal min/km (e.g. "5.5"); when the
          // line falls back to the cumulative day-integral the precision
          // must match the left axis so km/s/reps share a consistent
          // number format on both sides.
          precision: paceMode ? 1 : barAxisPrecision(measurement),
        },
        grid: { drawOnChartArea: false },
      },
    },
    // chartjs-plugin-datalabels is globally registered in app.config.ts.
    // Disable it for this chart to avoid gray object debug labels.
    plugins: {
      legend: { display: false },
      datalabels: { display: false },
      tooltip: {
        backgroundColor: colors.tooltipBg,
        titleColor: colors.tooltipTitle,
        bodyColor: colors.tooltipBody,
        borderColor: colors.tooltipBorder,
        borderWidth: 1,
        callbacks: {
          title: (items: TooltipItem<'bar' | 'line'>[]) => {
            const first = items[0];
            if (!first) return '';
            const ts = Number(first.parsed.x);
            if (!Number.isFinite(ts)) return '';
            const custom = bucketLabelByTs.get(ts);
            if (custom) return formatCustomHourBlock(custom, isGermanLocale);
            if (granularity === 'hourly') {
              return formatHourLabel(new Date(ts), isGermanLocale);
            }
            return formatBucketTitle(ts);
          },
          afterBody: (items: TooltipItem<'bar' | 'line'>[]) => {
            if (!hasSetsData) return '';
            const first = items[0];
            if (!first) return '';
            const ts = Number(first.parsed.x);
            const info = setsByBucket.get(ts);
            if (!info || info.totalSets === 0) return '';
            const lines: string[] = [
              '',
              `${info.totalSets} ${setsTooltipLabel}:`,
            ];
            for (const entrySet of info.sets) {
              lines.push(`   ${entrySet.join(' + ')}`);
            }
            return lines;
          },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}
