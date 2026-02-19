/* eslint-disable @typescript-eslint/no-explicit-any */
import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject, input } from '@angular/core';
import {
  CategoryScale,
  Chart,
  type ChartConfiguration,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import { BaseChartDirective } from 'ng2-charts';
import { PushupRecord } from '@pu-stats/models';

// Register required Chart.js pieces (safe to call multiple times)
Chart.register(
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  MatrixController,
  MatrixElement
);

export interface HeatmapCell {
  x: string; // weekday label
  y: string; // hour label
  v: number; // reps
}

@Component({
  selector: 'app-heatmap',
  standalone: true,
  imports: [BaseChartDirective],
  template: `
    @if (isBrowser) {
      <canvas
        baseChart
        [data]="chartData()"
        [options]="chartOptions"
        [type]="'matrix'"
      ></canvas>
    } @else {
      <div class="ssr-note">Heatmap wird im Browser geladen…</div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      min-height: 360px;
    }
    .ssr-note {
      padding: 12px;
      color: rgba(230, 237, 249, 0.7);
      font-size: 0.9rem;
    }
  `,
})
export class HeatmapComponent {
  readonly entries = input<PushupRecord[]>([]);

  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
  // top -> bottom: 23, 22, ... 00
  private readonly hoursTopDown = Array.from({ length: 24 }, (_, i) =>
    String(23 - i).padStart(2, '0')
  );

  readonly chartData = computed<any>(() => {
    const dataPoints: HeatmapCell[] = [];

    for (const day of this.days) {
      for (const hour of this.hoursTopDown) {
        dataPoints.push({ x: day, y: hour, v: 0 });
      }
    }

    const map = new Map<string, number>();
    for (const row of this.entries()) {
      const date = new Date(row.timestamp);
      // getDay(): 0=Sun, 1=Mon... -> convert to 0=Mon, 6=Sun
      const dayIndex = (date.getDay() + 6) % 7;
      const dayLabel = this.days[dayIndex];
      const hourLabel = String(date.getHours()).padStart(2, '0');
      const key = `${dayLabel}-${hourLabel}`;
      map.set(key, (map.get(key) ?? 0) + row.reps);
    }

    const data: HeatmapCell[] = dataPoints.map((p) => ({
      x: p.x,
      y: p.y,
      v: map.get(`${p.x}-${p.y}`) ?? 0,
    }));

    const max = Math.max(0, ...data.map((d) => d.v)) || 1;

    return {
      datasets: [
        {
          label: 'Pushups',
          data,
          backgroundColor: (context: any) => {
            const raw = context.raw as HeatmapCell;
            const value = raw?.v ?? 0;
            if (value <= 0) return 'rgba(0,0,0,0.04)';
            const alpha = 0.15 + (value / max) * 0.85;
            return `rgba(69, 137, 255, ${alpha})`;
          },
          borderColor: 'rgba(0,0,0,0)',
          borderWidth: 1,
          width: ({ chartArea }: { chartArea: { width: number } }) =>
            (chartArea || { width: 0 }).width / 7 - 1,
          height: ({ chartArea }: { chartArea: { height: number } }) =>
            (chartArea || { height: 0 }).height / 24 - 1,
        },
      ],
    };
  });

  // Keeping this in the component to avoid leaking Chart.js typing complexity into page components.
  readonly chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: () => '',
          label: (context: any) => {
            const v = context.raw as HeatmapCell;
            return `${v.x} ${v.y}:00 - ${v.v} Reps`;
          },
        },
      },
      // chartjs-plugin-datalabels is referenced via options in this project.
      datalabels: {
        display: (ctx: any) => {
          const raw = ctx.dataset.data?.[ctx.dataIndex] as
            | HeatmapCell
            | undefined;
          return !!raw && typeof raw.v === 'number' && raw.v > 0;
        },
        formatter: (value: HeatmapCell) => (value?.v ? String(value.v) : ''),
        anchor: 'center',
        align: 'center',
        clamp: true,
        color: (ctx: any) => {
          const raw = ctx.dataset.data?.[ctx.dataIndex] as
            | HeatmapCell
            | undefined;
          const v = typeof raw?.v === 'number' ? raw.v : 0;
          return v >= 10 ? 'rgba(10,12,18,0.95)' : 'rgba(230,237,249,0.95)';
        },
        font: (ctx: any) => {
          const raw = ctx.dataset.data?.[ctx.dataIndex] as
            | HeatmapCell
            | undefined;
          const v = typeof raw?.v === 'number' ? raw.v : 0;
          return { size: v >= 10 ? 11 : 10, weight: 700 };
        },
      },
    } as any,
    scales: {
      x: {
        type: 'category',
        labels: [...this.days],
        position: 'top',
        grid: { display: false },
      },
      y: {
        type: 'category',
        labels: [...this.hoursTopDown],
        offset: true,
        // labels are already top->bottom; no reverse needed.
        reverse: false,
        grid: { display: false },
      },
    },
  };
}
