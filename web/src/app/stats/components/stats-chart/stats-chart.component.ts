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
      <h2>{{ granularity === 'hourly' ? 'Verlauf (Stundenwerte)' : 'Verlauf (Tageswerte)' }}</h2>
      <div class="chart-host">
        <canvas id="statsChart"></canvas>
      </div>
      <p class="legend">Blau: Intervallwert · Orange: Tages-Integral</p>
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
    const data: ChartConfiguration<'bar'>['data'] = {
      labels: series.map((d) => d.bucket),
      datasets: [
        { label: 'Intervallwert', data: series.map((d) => d.total), backgroundColor: '#4f8cff88' },
        { label: 'Tages-Integral', data: series.map((d) => d.dayIntegral), type: 'line' as never, borderColor: '#ffb74d' },
      ],
    };

    this.chart = new Chart(element, {
      type: 'bar',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { ticks: { color: '#c8d3ea' } }, y: { ticks: { color: '#c8d3ea' } } },
        plugins: { legend: { labels: { color: '#d9e1f0' } } },
      },
    });
  }
}
