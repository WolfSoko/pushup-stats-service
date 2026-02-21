import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { StatsGranularity, StatsSeriesEntry } from '@pu-stats/models';

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
  private readonly zone = inject(NgZone);

  private readonly chartCanvas =
    viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  readonly granularity = input<StatsGranularity>('daily');
  readonly rangeMode = input<'day' | 'week' | 'month'>('week');
  readonly series = input<StatsSeriesEntry[]>([]);

  readonly hourlyTitle = $localize`:@@chart.titleHourly:Verlauf (Stundenwerte)`;
  readonly dailyTitle = $localize`:@@chart.titleDaily:Verlauf (Tageswerte)`;

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

    let context: CanvasRenderingContext2D | null = null;
    try {
      context = element.getContext('2d');
    } catch {
      return;
    }
    if (!context) return;

    this.zone.runOutsideAngular(() => {
      this.chart?.destroy();
      const totals = series.map((d) => d.total);
      const windowSize = this.granularity() === 'hourly' ? 3 : 7;
      const movingAvg = totals.map((_, index) => {
        const from = Math.max(0, index - windowSize + 1);
        const window = totals.slice(from, index + 1);
        const sum = window.reduce((acc, value) => acc + value, 0);
        return Number((sum / window.length).toFixed(2));
      });

      const data: ChartConfiguration<'bar' | 'line'>['data'] = {
        labels: series.map((d) => d.bucket),
        datasets: [
          {
            label: 'Intervallwert',
            data: totals,
            backgroundColor: '#5e8eff99',
            borderRadius: 6,
            maxBarThickness: 34,
          },
          {
            label: 'Tages-Integral',
            data: series.map((d) => d.dayIntegral),
            type: 'line',
            borderColor: '#ffbe66',
            backgroundColor: '#ffbe66',
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.24,
            yAxisID: 'y',
          },
          {
            label: 'Gleitender Durchschnitt',
            data: movingAvg,
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
              ticks: {
                color: '#c8d3ea',
                maxRotation: 0,
                autoSkip: this.rangeMode() === 'day' ? false : true,
                maxTicksLimit: this.rangeMode() === 'month' ? 12 : undefined,
                callback: (value, index) => {
                  const bucket = series[index]?.bucket ?? '';
                  if (this.rangeMode() === 'day') {
                    return bucket; // e.g. 08
                  }
                  // daily buckets are ISO dates (YYYY-MM-DD)
                  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(bucket)
                    ? new Date(`${bucket}T00:00:00`)
                    : null;
                  if (!parsed || Number.isNaN(parsed.getTime())) return bucket;

                  if (this.rangeMode() === 'week') {
                    const weekday = parsed.toLocaleDateString('de-DE', {
                      weekday: 'short',
                    });
                    return `${weekday}`;
                  }

                  // month
                  return String(parsed.getDate());
                },
              },
              grid: { color: 'rgba(116, 140, 190, 0.15)' },
            },
            y: {
              ticks: { color: '#c8d3ea', precision: 0 },
              grid: { color: 'rgba(116, 140, 190, 0.2)' },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(14,20,35,0.95)',
              titleColor: '#eff4ff',
              bodyColor: '#dbe6ff',
              borderColor: 'rgba(125, 154, 219, 0.35)',
              borderWidth: 1,
            },
          },
        },
      });
    });
  }
}
