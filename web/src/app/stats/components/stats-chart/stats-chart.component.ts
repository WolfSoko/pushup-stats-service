import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  ViewChild,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { Chart, registerables } from 'chart.js';
import { StatsGranularity, StatsSeriesEntry } from '@nx-temp/stats-models';

Chart.register(...registerables);

@Component({
  selector: 'app-stats-chart',
  imports: [MatCardModule],
  template: `
    <mat-card class="chart">
      <div class="chart-header">
        <div>
          <h2>{{ granularity() === 'hourly' ? 'Verlauf (Stundenwerte)' : 'Verlauf (Tageswerte)' }}</h2>
          <p>Intervallwerte als Balken, Tages-Integral + gleitender Durchschnitt als Trendlinien</p>
        </div>
      </div>

      <div class="chart-host">
        <canvas #chartCanvas></canvas>
      </div>

      <div class="legend" aria-label="Legende">
        <span><i class="dot dot-bar"></i>Intervallwert</span>
        <span><i class="dot dot-line"></i>Tages-Integral</span>
        <span><i class="dot dot-avg"></i>Gleitender Durchschnitt</span>
      </div>
    </mat-card>
  `,
  styleUrl: './stats-chart.component.scss',
})
export class StatsChartComponent implements AfterViewInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  @ViewChild('chartCanvas') private chartCanvas?: ElementRef<HTMLCanvasElement>;

  readonly granularity = input<StatsGranularity>('daily');
  readonly series = input<StatsSeriesEntry[]>([]);

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
    const element = this.chartCanvas?.nativeElement;
    if (!element) return;

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

      const data: any = {
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

      this.chart = new Chart(element, {
        type: 'bar',
        data,
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          scales: {
            x: {
              ticks: { color: '#c8d3ea', maxRotation: 0, autoSkip: true },
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
