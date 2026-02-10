import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
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
        <canvas id="statsChart"></canvas>
      </div>

      <div class="legend" aria-label="Legende">
        <span><i class="dot dot-bar"></i>Intervallwert</span>
        <span><i class="dot dot-line"></i>Tages-Integral</span>
      </div>
    </mat-card>
  `,
  styleUrl: './stats-chart.component.scss',
})
export class StatsChartComponent {
  @Input() granularity: StatsGranularity = 'daily';

  @Input() set series(value: StatsSeriesEntry[]) {
    if (typeof window === 'undefined') return;
    if (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom')) return;
    queueMicrotask(() => this.renderChart(value));
  }

  private chart?: Chart;

  private renderChart(series: StatsSeriesEntry[]): void {
    const element = document.getElementById('statsChart') as HTMLCanvasElement | null;
    if (!element) return;

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
          type: 'line' as never,
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
  }
}
