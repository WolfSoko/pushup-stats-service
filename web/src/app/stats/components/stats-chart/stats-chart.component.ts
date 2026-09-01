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
  output,
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
import { ChartLegendComponent } from '../chart-legend/chart-legend.component';
import { buildChartConfig } from './chart-config';
import {
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
  buildLegendItems,
  parseLegendId,
  type ChartSeriesKey,
  type HiddenExerciseLegendEntry,
} from './chart-legend-items';
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
  imports: [MatButtonToggleModule, MatCardModule, ChartLegendComponent],
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
  // Exercises this chart could draw but the user hid — listed in the
  // legend as hollow rings so the click that undoes it stays in reach.
  readonly hiddenExercises = input<ReadonlyArray<HiddenExerciseLegendEntry>>(
    []
  );

  /** Page-wide state, so the owner of `hiddenExercises` applies it. */
  readonly toggleExercise = output<string>();

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

  /**
   * Series switched off through the legend. Local rather than store
   * state: the lines describe this chart alone, and the same chart is
   * embedded on the dashboard teaser where no store is in reach.
   */
  private readonly hiddenSeries = signal<ReadonlySet<ChartSeriesKey>>(
    new Set()
  );

  readonly legendItems = computed(() =>
    buildLegendItems({
      breakdown: this.breakdown(),
      hiddenExercises: this.hiddenExercises(),
      hiddenSeries: this.hiddenSeries(),
      showsSetsSeries: this.hasSetsData(),
      labels: {
        bar: this.intervalLegendText(),
        sets: CHART_LABELS.withSets,
        secondary: this.secondaryLegendText(),
        movingAvg: this.movingAvgLegendText(),
      },
    })
  );

  readonly legendAriaLabel = $localize`:@@chart.legendAria:Legende`;

  private readonly viewReady = signal(false);
  private chart?: Chart;

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId) || !this.viewReady()) return;
      const currentSeries = this.series();
      const currentEntries = this.entries();
      // Track dayChartMode + measurement-driven inputs to re-render
      this.dayChartMode();
      this.measurement();
      this.paceSeries();
      this.breakdown();
      this.barMode();
      this.hiddenSeries();
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

  onLegendToggle(id: string): void {
    const parsed = parseLegendId(id);
    if (!parsed) return;
    if (parsed.kind === 'exercise') {
      this.toggleExercise.emit(parsed.key);
      return;
    }
    const key = parsed.key as ChartSeriesKey;
    const next = new Set(this.hiddenSeries());
    if (!next.delete(key)) next.add(key);
    this.hiddenSeries.set(next);
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

    const { data, options } = buildChartConfig({
      series,
      entries,
      granularity: this.granularity(),
      rangeMode: this.rangeMode(),
      dayChartMode: this.dayChartMode(),
      from: this.from(),
      to: this.to(),
      measurement: this.measurement(),
      paceMode: this.paceMode(),
      paceSeries: this.paceSeries(),
      breakdown: this.breakdown(),
      barMode: this.barMode(),
      hiddenSeries: this.hiddenSeries(),
      localeId: this.localeId,
      intervalLabel: this.intervalLegendText(),
      secondaryLabel: this.secondaryLegendText(),
      movingAvgLabel: this.movingAvgLegendText(),
    });

    this.chart = new Chart(context, { type: 'bar', data, options });
  }
}
