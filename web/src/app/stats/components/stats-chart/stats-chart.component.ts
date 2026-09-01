import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
  model,
  PLATFORM_ID,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { StatsGranularity, StatsSeriesEntry } from '@pu-stats/models';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { buildChartData } from './chart-data';
import {
  axisUnit as axisUnitForMeasurement,
  secondaryAxisUnit as buildSecondaryAxisUnit,
  secondaryLegendText as buildSecondaryLegend,
  unitSuffix as suffixForMeasurement,
} from './chart-copy';
import {
  CHART_LABELS,
  chartSubtitleFor,
  chartTitleFor,
  cumulativeLabelFor,
} from './chart-messages';
import {
  buildBucketLabelByTs,
  buildSetsByBucket,
  computeMovingAvg,
  hasSetsData as computeHasSetsData,
  movingAvgWindow,
} from './chart-helpers';
import { buildChartOptions, readThemeColors } from './chart-options';
import {
  ChartBarMode,
  ChartBreakdownSeries,
  ChartMeasurement,
  PaceSeriesEntry,
  StatsChartEntry,
} from './stats-chart.models';

Chart.register(...registerables);

@Component({
  selector: 'app-stats-chart',
  imports: [MatButtonToggleModule, MatCardModule],
  templateUrl: './stats-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './stats-chart.component.scss',
})
export class StatsChartComponent implements AfterViewInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly localeId = inject(LOCALE_ID);

  private readonly chartCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  readonly granularity = input<StatsGranularity>('daily');
  readonly rangeMode = input<'day' | 'week' | 'month' | 'year' | 'custom'>(
    'week'
  );
  readonly series = input<StatsSeriesEntry[]>([]);
  readonly from = input<string | null>(null);
  readonly to = input<string | null>(null);
  readonly dayChartMode = model<'24h' | '14h'>('14h');
  readonly entries = input<StatsChartEntry[]>([]);
  // Localised exercise label appended to the title; '' keeps the bare title.
  readonly kindLabel = input<string>('');
  // `null` keeps the legacy reps-centric copy for callers that haven't
  // opted into measurement-aware subtitle/legend/axis rendering yet.
  readonly measurement = input<ChartMeasurement>(null);
  // For `'distance'`/`'distance-time'` views with ≥1 non-null pace, swaps
  // the cumulative day-integral line for a km-pace line.
  readonly paceSeries = input<PaceSeriesEntry[]>([]);
  // One entry per exercise splits the aggregate bar into its parts.
  // Empty keeps the single-bar rendering (and its sets stacking).
  readonly breakdown = input<ChartBreakdownSeries[]>([]);
  readonly barMode = input<ChartBarMode>('stacked');

  readonly chartTitle = computed(() =>
    chartTitleFor(this.granularity(), this.kindLabel())
  );

  readonly subtitleText = computed(() => chartSubtitleFor(this.measurement()));

  readonly unitSuffix = computed(() =>
    suffixForMeasurement(this.measurement())
  );

  readonly paceMode = computed(() => {
    const m = this.measurement();
    if (m !== 'distance' && m !== 'distance-time') return false;
    return this.paceSeries().some((p) => p.pace !== null);
  });

  readonly intervalLegendText = computed(
    () => `${CHART_LABELS.interval}${this.unitSuffix()}`
  );

  readonly secondaryLegendText = computed(() =>
    buildSecondaryLegend(
      this.paceMode(),
      CHART_LABELS.pace,
      cumulativeLabelFor(this.granularity()),
      this.unitSuffix()
    )
  );

  readonly movingAvgLegendText = computed(
    () => `${CHART_LABELS.movingAvg}${this.unitSuffix()}`
  );

  readonly hasSetsData = computed(() =>
    this.entries().some((e) => (e.sets?.length ?? 0) > 1)
  );

  /** Per-exercise bars replace the aggregate bar, and its legend with it. */
  readonly showsBreakdown = computed(() => this.breakdown().length > 0);
  private readonly viewReady = signal(false);
  private chart?: Chart;

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId) || !this.viewReady()) return;
      const currentSeries = this.series();
      const currentEntries = this.entries();
      // Track every input `renderChart` reads. The axis-shaping ones
      // (granularity, rangeMode, from, to) decide bucket labels and
      // scale bounds without appearing in the series, so leaving them
      // untracked lets the chart keep an axis that no longer matches
      // the filter.
      this.granularity();
      this.rangeMode();
      this.from();
      this.to();
      this.dayChartMode();
      this.measurement();
      this.paceSeries();
      this.breakdown();
      this.barMode();
      queueMicrotask(() => this.renderChart(currentSeries, currentEntries));
    });
    // Destroy the chart when the component is torn down (e.g. the analysis
    // page toggles it out via `@if`). Without this, Chart.js's responsive
    // ResizeObserver outlives the element and a queued resize fires on the
    // detached chart — crashing in a plugin hook
    // (`Cannot set properties of undefined (setting '_listened')`).
    inject(DestroyRef).onDestroy(() => {
      this.chart?.destroy();
      this.chart = undefined;
    });
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.viewReady.set(true);
    }
  }

  private renderChart(
    series: StatsSeriesEntry[],
    entries: StatsChartEntry[] = []
  ): void {
    const element = this.chartCanvas()?.nativeElement;
    if (!element) return;

    const isVitestJsdom =
      typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
    if (isVitestJsdom) return;

    let context: CanvasRenderingContext2D | null;
    try {
      context = element.getContext('2d');
    } catch {
      return;
    }
    if (!context) return;

    this.chart?.destroy();

    const granularity = this.granularity();
    const dayChartMode = this.dayChartMode();
    const measurement = this.measurement();
    const paceMode = this.paceMode();

    const totals = series.map((d) => d.total);
    const movingAvg = computeMovingAvg(totals, movingAvgWindow(granularity));

    const bucketLabelByTs = buildBucketLabelByTs(series);
    const setsByBucket = buildSetsByBucket(entries, {
      granularity,
      dayChartMode,
      from: this.from(),
    });
    const breakdown = this.breakdown();
    const barMode = this.barMode();
    // The per-exercise split and the sets split decompose the same
    // volume, so the breakdown suppresses the sets stacking rather than
    // stacking both on top of each other.
    const hasSetsData = breakdown.length
      ? false
      : computeHasSetsData(setsByBucket);

    const data = buildChartData({
      series,
      breakdown,
      barMode,
      setsByBucket,
      hasSetsData,
      movingAvg,
      paceMode,
      paceSeries: this.paceSeries(),
      labels: {
        intervalDatasetLabel: this.intervalLegendText(),
        withSetsLabel: CHART_LABELS.withSets,
        secondaryLineLabel: this.secondaryLegendText(),
        movingAvgLabel: this.movingAvgLegendText(),
      },
    });

    const options = buildChartOptions({
      granularity,
      rangeMode: this.rangeMode(),
      measurement,
      dayChartMode,
      from: this.from(),
      to: this.to(),
      hasSetsData,
      stackedBreakdown: breakdown.length > 0 && barMode === 'stacked',
      paceMode,
      bucketLabelByTs,
      setsByBucket,
      colors: readThemeColors(),
      localeId: this.localeId,
      setsTooltipLabel: CHART_LABELS.setsTooltip,
      weekAbbrev: CHART_LABELS.weekAbbrev,
      yAxisTitle: axisUnitForMeasurement(measurement),
      ySecondaryAxisTitle: buildSecondaryAxisUnit(paceMode, measurement),
    });

    this.chart = new Chart(context, { type: 'bar', data, options });
  }
}
