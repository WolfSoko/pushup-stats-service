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
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { StatsGranularity, StatsSeriesEntry } from '@pu-stats/models';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { buildChartData } from './chart-data';
import {
  secondaryLegendText as buildSecondaryLegend,
  selectSubtitle,
  unitSuffix as suffixForMeasurement,
} from './chart-copy';
import {
  buildBucketLabelByTs,
  buildSetsByBucket,
  computeMovingAvg,
  hasSetsData as computeHasSetsData,
} from './chart-helpers';
import { buildChartOptions, readThemeColors } from './chart-options';
import {
  ChartMeasurement,
  PaceSeriesEntry,
  StatsChartEntry,
} from './stats-chart.models';

Chart.register(...registerables);

@Component({
  selector: 'app-stats-chart',
  imports: [MatButtonToggleModule, MatCardModule],
  templateUrl: './stats-chart.component.html',
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

  readonly hourlyTitle = $localize`:@@chart.titleHourly:Verlauf (Stundenwerte)`;
  readonly dailyTitle = $localize`:@@chart.titleDaily:Verlauf (Tageswerte)`;
  readonly chartTitle = computed(() => {
    const base =
      this.granularity() === 'hourly' ? this.hourlyTitle : this.dailyTitle;
    const label = this.kindLabel().trim();
    return label ? `${base} – ${label}` : base;
  });

  // -- Localised copy -----------------------------------------------------
  // Subtitle variants are pre-extracted as $localize tagged templates so
  // the i18n extractor picks every wording up; the active subtitle is
  // selected at render time based on `measurement()`.
  private readonly subtitleReps = $localize`:@@chart.subtitle.reps:Balken zeigen deine Wiederholungen pro Zeitabschnitt. Die orange Linie summiert den Tag, die grüne zeigt deinen Trend.`;
  private readonly subtitleTime = $localize`:@@chart.subtitle.time:Balken zeigen deine Übungsdauer (s) pro Zeitabschnitt. Die orange Linie summiert den Tag, die grüne zeigt deinen Trend.`;
  private readonly subtitleDistance = $localize`:@@chart.subtitle.distance:Balken zeigen deine Strecke (km) pro Zeitabschnitt. Die orange Linie zeigt dein Tempo (min/km), die grüne deinen Strecken-Trend.`;
  private readonly subtitleWeight = $localize`:@@chart.subtitle.weight:Balken zeigen dein Trainingsgewicht (kg) pro Zeitabschnitt. Die orange Linie summiert den Tag, die grüne zeigt deinen Trend.`;
  private readonly subtitleMixed = $localize`:@@chart.subtitle.mixed:Balken zeigen dein Trainingsvolumen pro Zeitabschnitt. Die orange Linie summiert den Tag, die grüne zeigt deinen Trend.`;

  readonly subtitleText = computed(() =>
    selectSubtitle(this.measurement(), {
      reps: this.subtitleReps,
      time: this.subtitleTime,
      distance: this.subtitleDistance,
      weight: this.subtitleWeight,
      mixed: this.subtitleMixed,
    })
  );

  readonly intervalLabel = $localize`:@@chart.interval:Intervallwert`;
  readonly dayIntegralLabel = $localize`:@@chart.dayIntegral:Tages-Integral`;
  readonly paceLabel = $localize`:@@chart.kmPace:km Tempo`;
  readonly movingAvgLabel = $localize`:@@chart.movingAvg:Gleitender Durchschnitt`;

  readonly unitSuffix = computed(() =>
    suffixForMeasurement(this.measurement())
  );

  readonly paceMode = computed(() => {
    const m = this.measurement();
    if (m !== 'distance' && m !== 'distance-time') return false;
    return this.paceSeries().some((p) => p.pace !== null);
  });

  readonly intervalLegendText = computed(
    () => `${this.intervalLabel}${this.unitSuffix()}`
  );

  readonly secondaryLegendText = computed(() =>
    buildSecondaryLegend(
      this.paceMode(),
      this.paceLabel,
      this.dayIntegralLabel,
      this.unitSuffix()
    )
  );

  readonly movingAvgLegendText = computed(
    () => `${this.movingAvgLabel}${this.unitSuffix()}`
  );

  readonly hasSetsData = computed(() =>
    this.entries().some((e) => (e.sets?.length ?? 0) > 1)
  );
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

  readonly setsTooltipLabel = $localize`:@@chart.setsTooltip:Sets`;
  readonly withSetsLabel = $localize`:@@chart.withSets:Mit Sets`;

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
    const suffix = this.unitSuffix();

    const totals = series.map((d) => d.total);
    const movingAvg = computeMovingAvg(
      totals,
      granularity === 'hourly' ? 3 : 7
    );

    const bucketLabelByTs = buildBucketLabelByTs(series);
    const setsByBucket = buildSetsByBucket(entries, granularity, dayChartMode);
    const hasSetsData = computeHasSetsData(setsByBucket);

    const intervalDatasetLabel = `${this.intervalLabel}${suffix}`;
    const secondaryLineLabel = buildSecondaryLegend(
      paceMode,
      this.paceLabel,
      this.dayIntegralLabel,
      suffix
    );

    const data = buildChartData({
      series,
      setsByBucket,
      hasSetsData,
      movingAvg,
      paceMode,
      paceSeries: this.paceSeries(),
      labels: {
        intervalDatasetLabel,
        withSetsLabel: this.withSetsLabel,
        secondaryLineLabel,
        movingAvgLabel: `${this.movingAvgLabel}${suffix}`,
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
      paceMode,
      bucketLabelByTs,
      setsByBucket,
      colors: readThemeColors(),
      localeId: this.localeId,
      setsTooltipLabel: this.setsTooltipLabel,
    });

    this.chart = new Chart(context, { type: 'bar', data, options });
  }
}
