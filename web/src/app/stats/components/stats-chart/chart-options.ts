import { StatsGranularity } from '@pu-stats/models';
import { ChartConfiguration, TooltipItem } from 'chart.js';
import { BucketSetsInfo, ChartMeasurement } from './stats-chart.models';
import {
  barAxisPrecision,
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
  paceMode: boolean;
  bucketLabelByTs: Map<number, string>;
  setsByBucket: Map<number, BucketSetsInfo>;
  colors: ChartThemeColors;
  localeId: string;
  setsTooltipLabel: string;
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
    paceMode,
    bucketLabelByTs,
    setsByBucket,
    colors,
    localeId,
    setsTooltipLabel,
  } = inputs;

  const isCompactDayMode = granularity === 'hourly' && dayChartMode === '14h';

  const xTickFormatter = new Intl.DateTimeFormat(
    localeId,
    granularity === 'hourly'
      ? { hour: '2-digit' }
      : { day: '2-digit', month: '2-digit' }
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
      : {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }
  );

  return {
    animation: false,
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    scales: {
      x: {
        type: 'time',
        stacked: hasSetsData,
        min:
          rangeMode === 'day'
            ? undefined
            : from
              ? new Date(`${from}T00:00:00`).getTime()
              : undefined,
        max:
          rangeMode === 'day'
            ? undefined
            : to
              ? new Date(`${to}T23:59:59`).getTime()
              : undefined,
        time: {
          unit: granularity === 'hourly' ? 'hour' : 'day',
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
        stacked: hasSetsData,
        ticks: {
          color: colors.chartTick,
          // km bars use 1 decimal; reps/seconds stay integer.
          precision: barAxisPrecision(measurement),
        },
        grid: { color: colors.chartGrid },
      },
      yIntegral: {
        position: 'right',
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
            return tooltipTitleFormatter.format(new Date(ts));
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
