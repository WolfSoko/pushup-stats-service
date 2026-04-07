import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import {
  PushupRecord,
  StatsGranularity,
  StatsSeriesEntry,
} from '@pu-stats/models';
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
  imports: [MatCardModule],
  template: `
    <mat-card class="chart">
      <mat-card-header>
        <mat-card-title>{{
          granularity() === 'hourly' ? hourlyTitle : dailyTitle
        }}</mat-card-title>
        <mat-card-subtitle i18n="@@chart.subtitle"
          >Intervallwerte als Balken, Tages-Integral + gleitender Durchschnitt
          als Trendlinien</mat-card-subtitle
        >
      </mat-card-header>

      <mat-card-content>
        <div class="chart-host">
          <canvas #chartCanvas></canvas>
        </div>

        <div
          class="legend"
          aria-label="Legende"
          i18n-aria-label="@@chart.legendAria"
        >
          <span
            ><i class="dot dot-bar"></i
            ><ng-container i18n="@@chart.interval"
              >Intervallwert</ng-container
            ></span
          >
          <span
            ><i class="dot dot-line"></i
            ><ng-container i18n="@@chart.dayIntegral"
              >Tages-Integral</ng-container
            ></span
          >
          <span
            ><i class="dot dot-avg"></i
            ><ng-container i18n="@@chart.movingAvg"
              >Gleitender Durchschnitt</ng-container
            ></span
          >
          @if (hasSetsData()) {
            <span
              ><i class="dot dot-sets-bar"></i
              ><ng-container i18n="@@chart.withSets"
                >Mit Sets</ng-container
              ></span
            >
          }
          @if (avgSetSizeTrend().length) {
            <span
              ><i class="dot dot-set"></i
              ><ng-container i18n="@@chart.avgSetSize"
                >Ø Set-Größe</ng-container
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
  readonly dayChartMode = input<'24h' | '14h'>('14h');
  readonly avgSetSizeTrend = input<Array<{ date: string; avg: number }>>([]);
  readonly entries = input<PushupRecord[]>([]);

  readonly hourlyTitle = $localize`:@@chart.titleHourly:Verlauf (Stundenwerte)`;
  readonly dailyTitle = $localize`:@@chart.titleDaily:Verlauf (Tageswerte)`;
  readonly intervalLabel = $localize`:@@chart.interval:Intervallwert`;
  readonly dayIntegralLabel = $localize`:@@chart.dayIntegral:Tages-Integral`;
  readonly movingAvgLabel = $localize`:@@chart.movingAvg:Gleitender Durchschnitt`;

  readonly hasSetsData = computed(() =>
    this.entries().some((e) => e.sets?.length)
  );
  private readonly viewReady = signal(false);
  private chart?: Chart;

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId) || !this.viewReady()) return;
      const currentSeries = this.series();
      const currentEntries = this.entries();
      const currentSetTrend = this.avgSetSizeTrend();
      queueMicrotask(() =>
        this.renderChart(currentSeries, currentEntries, currentSetTrend)
      );
    });
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.viewReady.set(true);
    }
  }

  readonly avgSetSizeLabel = $localize`:@@chart.avgSetSize:Ø Set-Größe`;
  readonly setsTooltipLabel = $localize`:@@chart.setsTooltip:Sets`;

  private renderChart(
    series: StatsSeriesEntry[],
    entries: PushupRecord[] = [],
    setTrendInput: Array<{ date: string; avg: number }> = []
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

    // Build per-bucket sets info from raw entries for bar coloring & tooltip
    const isHourly = this.granularity() === 'hourly';
    const setsByBucket = new Map<
      number,
      { sets: number[][]; totalSets: number }
    >();
    for (const entry of entries) {
      if (!entry.sets?.length) continue;
      const date = new Date(entry.timestamp);
      let bucketTs: number;
      if (isHourly) {
        bucketTs = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          date.getHours()
        ).getTime();
      } else {
        bucketTs = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        ).getTime();
      }
      const info = setsByBucket.get(bucketTs) ?? { sets: [], totalSets: 0 };
      info.sets.push(entry.sets);
      info.totalSets += entry.sets.length;
      setsByBucket.set(bucketTs, info);
    }

    const hasSetsData = setsByBucket.size > 0;

    const setTrend = setTrendInput;
    const setTrendDataset = setTrend.length
      ? [
          {
            label: this.avgSetSizeLabel,
            data: setTrend.map((d) => ({
              x: new Date(`${d.date}T12:00:00`).getTime(),
              y: d.avg,
            })),
            type: 'line' as const,
            borderColor: '#e040fb',
            backgroundColor: '#e040fb',
            borderDash: [4, 3],
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.3,
            yAxisID: 'ySetSize',
          },
        ]
      : [];

    const data: ChartConfiguration<'bar' | 'line'>['data'] = {
      datasets: [
        {
          label: this.intervalLabel,
          data: series.map((d) => ({
            x: this.bucketToTs(d.bucket),
            y: d.total,
          })),
          backgroundColor: hasSetsData
            ? series.map((d) => {
                const ts = this.bucketToTs(d.bucket);
                return setsByBucket.has(ts) ? '#ab47bccc' : '#5e8eff99';
              })
            : '#5e8eff99',
          borderColor: hasSetsData
            ? series.map((d) => {
                const ts = this.bucketToTs(d.bucket);
                return setsByBucket.has(ts) ? '#ce93d8' : 'transparent';
              })
            : 'transparent',
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 34,
        },
        {
          label: this.dayIntegralLabel,
          data: series.map((d) => ({
            x: this.bucketToTs(d.bucket),
            y: d.dayIntegral,
          })),
          type: 'line',
          borderColor: '#ffbe66',
          backgroundColor: '#ffbe66',
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.24,
          yAxisID: 'yIntegral',
        },
        {
          label: this.movingAvgLabel,
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
        },
        ...setTrendDataset,
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
            ticks: { color: chartTick, precision: 0 },
            grid: { color: chartGrid },
          },
          yIntegral: {
            position: 'right',
            ticks: { color: '#ffbe66', precision: 0 },
            grid: { drawOnChartArea: false },
          },
          ...(setTrend.length
            ? {
                ySetSize: {
                  position: 'right' as const,
                  ticks: { color: '#e040fb', precision: 1 },
                  grid: { drawOnChartArea: false },
                  title: {
                    display: true,
                    text: this.avgSetSizeLabel,
                    color: '#e040fb',
                  },
                },
              }
            : {}),
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
                if (!info) return '';
                const lines: string[] = [
                  '',
                  `${info.totalSets} ${this.setsTooltipLabel}:`,
                ];
                for (const entrySet of info.sets) {
                  lines.push(
                    `   ${entrySet.join(' + ')} = ${entrySet.reduce((a, b) => a + b, 0)}`
                  );
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
}
