import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  PLATFORM_ID,
  ViewChild,
  inject,
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
          <h2>{{ granularity === 'hourly' ? 'Verlauf (Stundenwerte)' : 'Verlauf (Tageswerte)' }}</h2>
          <p>Intervallwerte als Balken, Tages-Integral als Trendlinie</p>
        </div>
      </div>

      <div class="chart-host">
        <canvas #chartCanvas></canvas>
      </div>

      <div class="legend" aria-label="Legende">
        <span><i class="dot dot-bar"></i>Intervallwert</span>
        <span><i class="dot dot-line"></i>Tages-Integral</span>
      </div>
    </mat-card>
  `,
  styleUrl: './stats-chart.component.scss',
})
export class StatsChartComponent implements AfterViewInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  @ViewChild('chartCanvas') private chartCanvas?: ElementRef<HTMLCanvasElement>;

  @Input() granularity: StatsGranularity = 'daily';

  private pendingSeries: StatsSeriesEntry[] = [];

  @Input() set series(value: StatsSeriesEntry[]) {
    this.pendingSeries = value ?? [];
    if (isPlatformBrowser(this.platformId)) {
      queueMicrotask(() => this.renderChart(this.pendingSeries));
    }
  }

  private chart?: Chart;

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.renderChart(this.pendingSeries);
    }
  }

  private renderChart(series: StatsSeriesEntry[]): void {
    const element = this.chartCanvas?.nativeElement;
    if (!element) return;

    this.zone.runOutsideAngular(() => {
      this.chart?.destroy();
      const data: any = {
        labels: series.map((d) => d.bucket),
        datasets: [
          {
            label: 'Intervallwert',
            data: series.map((d) => d.total),
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
