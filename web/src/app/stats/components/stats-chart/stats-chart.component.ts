import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
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
import { StatsGranularity, StatsSeriesEntry } from '@pu-stats/models';
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

  readonly hourlyTitle = $localize`:@@chart.titleHourly:Verlauf (Stundenwerte)`;
  readonly dailyTitle = $localize`:@@chart.titleDaily:Verlauf (Tageswerte)`;
  readonly intervalLabel = $localize`:@@chart.interval:Intervallwert`;
  readonly dayIntegralLabel = $localize`:@@chart.dayIntegral:Tages-Integral`;
  readonly movingAvgLabel = $localize`:@@chart.movingAvg:Gleitender Durchschnitt`;

  private readonly viewReady = signal(false);
  private chart?: Chart;

  constructor() {
    effect(() => {
      if (!isPlatformBrowser(this.platformId) || !this.viewReady()) return;
      const currentSeries = this.series();
      queueMicrotask(() => this.renderChart(currentSeries));
    });
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.viewReady.set(true);
    }
  }

  private renderChart(series: StatsSeriesEntry[]): void {
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

    const data: ChartConfiguration<'bar' | 'line'>['data'] = {
      datasets: [
        {
          label: this.intervalLabel,
          data: series.map((d) => ({
            x: this.bucketToTs(d.bucket),
            y: d.total,
          })),
          backgroundColor: '#5e8eff99',
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
              color: '#c8d3ea',
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
            grid: { color: 'rgba(116, 140, 190, 0.15)' },
          },
          y: {
            ticks: { color: '#c8d3ea', precision: 0 },
            grid: { color: 'rgba(116, 140, 190, 0.2)' },
          },
          yIntegral: {
            position: 'right',
            ticks: { color: '#ffbe66', precision: 0 },
            grid: { drawOnChartArea: false },
          },
        },
        // chartjs-plugin-datalabels is globally registered in app.config.ts.
        // Disable it for this chart to avoid gray object debug labels.
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            backgroundColor: 'rgba(14,20,35,0.95)',
            titleColor: '#eff4ff',
            bodyColor: '#dbe6ff',
            borderColor: 'rgba(125, 154, 219, 0.35)',
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
