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
import {
  type MeasurementType,
  StatsGranularity,
  StatsSeriesEntry,
} from '@pu-stats/models';

/**
 * Minimum shape the chart reads off each entry for sets-stacking. Both
 * the legacy {@link PushupRecord} and the analysis store's view-scoped
 * unified feed satisfy this, so the input can ingest either without an
 * intermediate adapter.
 */
export interface StatsChartEntry {
  timestamp: string;
  reps: number;
  sets?: number[];
}

/**
 * Per-bucket pace value (min/km) aligned 1:1 with the bar series. Used
 * for `'distance'` / `'distance-time'` views where the cumulative
 * "day-integral" line is replaced with a pace line. `null` breaks the
 * line at gaps (buckets without distance data).
 */
export interface PaceSeriesEntry {
  bucket: string;
  pace: number | null;
}

/**
 * Aggregate measurement label feeding the chart's subtitle, legend, and
 * y-axis tick formatters. `'mixed'` is for views that span more than
 * one measurement (e.g. core: reps + time); `null` is the empty-view
 * fallback. Other values mirror {@link MeasurementType}.
 */
export type ChartMeasurement = MeasurementType | 'mixed' | null;
import {
  Chart,
  ChartConfiguration,
  TooltipItem,
  registerables,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables);

@Component({
  selector: 'app-stats-chart',
  imports: [MatButtonToggleModule, MatCardModule],
  template: `
    <mat-card class="chart">
      <mat-card-header>
        <mat-card-title data-testid="stats-chart-title">{{
          chartTitle()
        }}</mat-card-title>
        <mat-card-subtitle data-testid="stats-chart-subtitle">{{
          subtitleText()
        }}</mat-card-subtitle>
        @if (granularity() === 'hourly') {
          <mat-button-toggle-group
            [value]="dayChartMode()"
            (change)="dayChartMode.set($event.value)"
            class="chart-mode-toggle"
            aria-label="Zeitraum der Stundenansicht"
            i18n-aria-label="@@chart.modeToggleAria"
          >
            <mat-button-toggle value="14h" i18n="@@chart.mode14h"
              >14h</mat-button-toggle
            >
            <mat-button-toggle value="24h" i18n="@@chart.mode24h"
              >24h</mat-button-toggle
            >
          </mat-button-toggle-group>
        }
      </mat-card-header>

      <mat-card-content>
        <div class="chart-host">
          <canvas #chartCanvas></canvas>
        </div>

        <div
          class="legend"
          aria-label="Legende"
          i18n-aria-label="@@chart.legendAria"
          data-testid="stats-chart-legend"
        >
          <span><i class="dot dot-bar"></i>{{ intervalLegendText() }}</span>
          <span><i class="dot dot-line"></i>{{ secondaryLegendText() }}</span>
          <span><i class="dot dot-avg"></i>{{ movingAvgLegendText() }}</span>
          @if (hasSetsData()) {
            <span
              ><i class="dot dot-sets-bar"></i
              ><ng-container i18n="@@chart.withSets"
                >Mit Sets</ng-container
              ></span
            >
          }
        </div>
      </mat-card-content>
    </mat-card>
  `,
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
  /**
   * Localised label naming the exercise (or group of exercises) the
   * series represents — appended to the title so users can tell at a
   * glance whether they are looking at pushups, sit-ups, an aggregated
   * "all exercises" view, etc. Empty string keeps the legacy bare
   * title.
   */
  readonly kindLabel = input<string>('');
  /**
   * Aggregate measurement type of the bar series. Drives subtitle copy,
   * legend units, y-axis tick formatting, and whether the orange line
   * shows the cumulative day integral or km-pace. `null` (the default)
   * preserves the legacy reps-centric copy for callers that haven't
   * opted into measurement-aware rendering yet.
   */
  readonly measurement = input<ChartMeasurement>(null);
  /**
   * Per-bucket pace (min/km) aligned with the bar series. When the
   * view's {@link measurement} is `'distance'` / `'distance-time'` and
   * this array contains at least one non-null pace, the chart swaps
   * the cumulative day-integral line for a km-Tempo line.
   */
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

  readonly subtitleText = computed(() => {
    switch (this.measurement()) {
      case 'time':
        return this.subtitleTime;
      case 'distance':
      case 'distance-time':
        return this.subtitleDistance;
      case 'weight':
        return this.subtitleWeight;
      case 'mixed':
        return this.subtitleMixed;
      case 'reps':
      case null:
      default:
        return this.subtitleReps;
    }
  });

  readonly intervalLabel = $localize`:@@chart.interval:Intervallwert`;
  readonly dayIntegralLabel = $localize`:@@chart.dayIntegral:Tages-Integral`;
  readonly paceLabel = $localize`:@@chart.kmPace:km Tempo`;
  readonly movingAvgLabel = $localize`:@@chart.movingAvg:Gleitender Durchschnitt`;

  /**
   * Unit suffix appended to the bar series label and matching legend
   * entries. Empty string for the legacy / unknown / mixed case so the
   * label reads exactly as before.
   */
  readonly unitSuffix = computed(() => {
    switch (this.measurement()) {
      case 'time':
        return ' (s)';
      case 'distance':
      case 'distance-time':
        return ' (km)';
      case 'weight':
        return ' (kg)';
      case 'reps':
        return ' (Reps)';
      default:
        return '';
    }
  });

  readonly paceMode = computed(() => {
    const m = this.measurement();
    if (m !== 'distance' && m !== 'distance-time') return false;
    return this.paceSeries().some((p) => p.pace !== null);
  });

  readonly intervalLegendText = computed(
    () => `${this.intervalLabel}${this.unitSuffix()}`
  );

  readonly secondaryLegendText = computed(() =>
    this.paceMode()
      ? `${this.paceLabel} (min/km)`
      : `${this.dayIntegralLabel}${this.unitSuffix()}`
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

    // Read theme-aware colors from CSS custom properties
    const cs = getComputedStyle(document.documentElement);
    const chartTick = cs.getPropertyValue('--chart-tick').trim() || '#c8d3ea';
    const chartGrid =
      cs.getPropertyValue('--chart-grid').trim() || 'rgba(116,140,190,0.2)';
    const chartGridLight =
      cs.getPropertyValue('--chart-grid-light').trim() ||
      'rgba(116,140,190,0.15)';
    const tooltipBg =
      cs.getPropertyValue('--tooltip-bg').trim() || 'rgba(14,20,35,0.95)';
    const tooltipTitle =
      cs.getPropertyValue('--tooltip-title').trim() || '#eff4ff';
    const tooltipBody =
      cs.getPropertyValue('--tooltip-body').trim() || '#dbe6ff';
    const tooltipBorder =
      cs.getPropertyValue('--tooltip-border').trim() ||
      'rgba(125,154,219,0.35)';

    const totals = series.map((d) => d.total);
    const windowSize = this.granularity() === 'hourly' ? 3 : 7;
    const movingAvg = totals.map((_, index) => {
      const from = Math.max(0, index - windowSize + 1);
      const window = totals.slice(from, index + 1);
      const sum = window.reduce((acc, value) => acc + value, 0);
      return Number((sum / window.length).toFixed(2));
    });

    const bucketLabelByTs = new Map<number, string>();
    for (const entry of series) {
      if (!entry.bucketLabel) continue;
      const ts = this.bucketToTs(entry.bucket);
      if (Number.isFinite(ts)) bucketLabelByTs.set(ts, entry.bucketLabel);
    }

    // Build per-bucket sets info from raw entries for stacked bars & tooltip
    const isHourly = this.granularity() === 'hourly';
    const is14h = isHourly && this.dayChartMode() === '14h';
    const setsByBucket = new Map<
      number,
      {
        setsReps: number;
        noSetsReps: number;
        sets: number[][];
        totalSets: number;
      }
    >();
    for (const entry of entries) {
      const date = new Date(entry.timestamp);
      let bucketTs: number;
      if (isHourly) {
        const hour = date.getHours();
        // In 14h mode, hours 0-7 and 22-23 merge into the 00:00 bucket
        const mappedHour = is14h && (hour < 8 || hour >= 22) ? 0 : hour;
        bucketTs = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          mappedHour
        ).getTime();
      } else {
        bucketTs = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        ).getTime();
      }
      const info = setsByBucket.get(bucketTs) ?? {
        setsReps: 0,
        noSetsReps: 0,
        sets: [],
        totalSets: 0,
      };
      if (entry.sets && entry.sets.length > 1) {
        info.setsReps += entry.reps;
        info.sets.push(entry.sets);
        info.totalSets += entry.sets.length;
      } else {
        info.noSetsReps += entry.reps;
      }
      setsByBucket.set(bucketTs, info);
    }

    const hasSetsData = [...setsByBucket.values()].some((b) => b.setsReps > 0);

    const intervalDatasetLabel = `${this.intervalLabel}${this.unitSuffix()}`;
    // Build stacked bar datasets when sets data exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const barDatasets: any[] = hasSetsData
      ? [
          {
            label: intervalDatasetLabel,
            data: series.map((d) => {
              const ts = this.bucketToTs(d.bucket);
              const info = setsByBucket.get(ts);
              return { x: ts, y: info ? info.noSetsReps : d.total };
            }),
            backgroundColor: '#5e8eff99',
            borderRadius: 0,
            maxBarThickness: 34,
            stack: 'reps',
          },
          {
            label: this.withSetsLabel,
            data: series.map((d) => {
              const ts = this.bucketToTs(d.bucket);
              const info = setsByBucket.get(ts);
              return { x: ts, y: info?.setsReps ?? 0 };
            }),
            backgroundColor: '#ab47bccc',
            borderRadius: 6,
            maxBarThickness: 34,
            stack: 'reps',
          },
        ]
      : [
          {
            label: intervalDatasetLabel,
            data: series.map((d) => ({
              x: this.bucketToTs(d.bucket),
              y: d.total,
            })),
            backgroundColor: '#5e8eff99',
            borderRadius: 6,
            maxBarThickness: 34,
          },
        ];

    const paceMode = this.paceMode();
    const paceByBucket = new Map<number, number | null>();
    if (paceMode) {
      for (const p of this.paceSeries()) {
        paceByBucket.set(this.bucketToTs(p.bucket), p.pace);
      }
    }

    const secondaryLineLabel = paceMode
      ? `${this.paceLabel} (min/km)`
      : `${this.dayIntegralLabel}${this.unitSuffix()}`;
    const secondaryLineData = paceMode
      ? series.map((d) => {
          const ts = this.bucketToTs(d.bucket);
          const pace = paceByBucket.get(ts);
          return { x: ts, y: pace ?? null };
        })
      : series.map((d) => ({
          x: this.bucketToTs(d.bucket),
          y: d.dayIntegral,
        }));

    const data: ChartConfiguration<'bar' | 'line'>['data'] = {
      datasets: [
        ...barDatasets,
        {
          label: secondaryLineLabel,
          data: secondaryLineData,
          type: 'line',
          borderColor: '#ffbe66',
          backgroundColor: '#ffbe66',
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.24,
          yAxisID: 'yIntegral',
          spanGaps: false,
        },
        {
          label: `${this.movingAvgLabel}${this.unitSuffix()}`,
          data: movingAvg.map((avg, index) => ({
            x: this.bucketToTs(series[index].bucket),
            y: avg,
          })),
          type: 'line',
          borderColor: '#7ef0c8',
          backgroundColor: '#7ef0c8',
          borderDash: [7, 5],
          pointRadius: 0,
          pointHoverRadius: 3,
          tension: 0.32,
          yAxisID: 'y',
          stack: 'movingAvg',
        },
      ],
    };

    const isCompactDayMode =
      this.granularity() === 'hourly' && this.dayChartMode() === '14h';

    const xTickFormatter = new Intl.DateTimeFormat(
      this.localeId,
      this.granularity() === 'hourly'
        ? { hour: '2-digit' }
        : { day: '2-digit', month: '2-digit' }
    );
    const isGermanLocale = this.localeId.toLowerCase().startsWith('de');
    const tooltipTitleFormatter = new Intl.DateTimeFormat(
      this.localeId,
      this.granularity() === 'hourly'
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

    this.chart = new Chart(context, {
      type: 'bar',
      data,
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            type: 'time',
            stacked: hasSetsData,
            min:
              this.rangeMode() === 'day'
                ? undefined
                : this.from()
                  ? new Date(`${this.from()}T00:00:00`).getTime()
                  : undefined,
            max:
              this.rangeMode() === 'day'
                ? undefined
                : this.to()
                  ? new Date(`${this.to()}T23:59:59`).getTime()
                  : undefined,
            time: {
              unit: this.granularity() === 'hourly' ? 'hour' : 'day',
            },
            ticks: {
              color: chartTick,
              maxRotation: 0,
              autoSkip: this.rangeMode() !== 'day',
              maxTicksLimit: isCompactDayMode ? 15 : 12,
              callback: (value) => {
                const ts = Number(value);
                if (!Number.isFinite(ts)) return '';
                const custom = bucketLabelByTs.get(ts);
                if (custom)
                  return this.formatCustomHourBlock(custom, isGermanLocale);
                if (this.granularity() === 'hourly') {
                  return this.formatHourLabel(new Date(ts), isGermanLocale);
                }
                return xTickFormatter.format(new Date(ts));
              },
            },
            grid: { color: chartGridLight },
          },
          y: {
            stacked: hasSetsData,
            ticks: {
              color: chartTick,
              // km bars use 1 decimal; reps/seconds stay integer.
              precision: this.barAxisPrecision(),
            },
            grid: { color: chartGrid },
          },
          yIntegral: {
            position: 'right',
            ticks: {
              color: '#ffbe66',
              // Pace ticks render as decimal min/km (e.g. "5.5"); when
              // the line falls back to the cumulative day-integral the
              // precision must match the left axis so km/s/reps share a
              // consistent number format on both sides.
              precision: paceMode ? 1 : this.barAxisPrecision(),
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
            backgroundColor: tooltipBg,
            titleColor: tooltipTitle,
            bodyColor: tooltipBody,
            borderColor: tooltipBorder,
            borderWidth: 1,
            callbacks: {
              title: (items: TooltipItem<'bar' | 'line'>[]) => {
                const first = items[0];
                if (!first) return '';
                const ts = Number(first.parsed.x);
                if (!Number.isFinite(ts)) return '';
                const custom = bucketLabelByTs.get(ts);
                if (custom)
                  return this.formatCustomHourBlock(custom, isGermanLocale);
                if (this.granularity() === 'hourly') {
                  return this.formatHourLabel(new Date(ts), isGermanLocale);
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
                  `${info.totalSets} ${this.setsTooltipLabel}:`,
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
      },
    });
  }

  private formatHourLabel(value: Date, isGermanLocale: boolean): string {
    const hour = value.getHours();
    if (isGermanLocale) return `${String(hour).padStart(2, '0')}h`;

    const suffix = hour < 12 ? 'AM' : 'PM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}${suffix}`;
  }

  private formatCustomHourBlock(raw: string, isGermanLocale: boolean): string {
    if (raw !== '00-07') return raw;
    return isGermanLocale ? '00-07h' : '12AM-7AM';
  }

  private bucketToTs(bucket: string): number {
    const normalized = bucket.length === 10 ? `${bucket}T00:00:00` : bucket;
    return new Date(normalized).getTime();
  }

  private barAxisPrecision(): number {
    const m = this.measurement();
    return m === 'distance' || m === 'distance-time' ? 1 : 0;
  }
}
