import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject, input } from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { PushupRecord } from '@pu-stats/models';
import { ensureHeatmapChartRegistered } from './chart-setup';
import {
  buildHeatmapCells,
  defaultHeatmapDays,
  defaultHeatmapHoursTopDown,
  heatmapCellColor,
} from './heatmap.utils';

ensureHeatmapChartRegistered();

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

  private readonly days = defaultHeatmapDays;
  private readonly hoursTopDown = defaultHeatmapHoursTopDown;

  // Matrix chart typing is tricky with string category axes; keep this loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly chartData = computed<any>(() => {
    const data = buildHeatmapCells({
      entries: this.entries(),
      days: this.days,
      hoursTopDown: this.hoursTopDown,
    });

    const max = Math.max(0, ...data.map((d) => d.v)) || 1;

    return {
      datasets: [
        {
          label: 'Pushups',
          data,
          backgroundColor: (context: unknown) => {
            const raw = (context as { raw?: HeatmapCell }).raw;
            return heatmapCellColor({ value: raw?.v ?? 0, max });
          },
          borderColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          // chartjs-chart-matrix provides the chart instance via ctx.chart
          // Using chart.chartArea avoids 0px cells during initial layout.
          width: (ctx: unknown) => {
            const area = (ctx as { chart?: { chartArea?: { width: number } } })
              ?.chart?.chartArea;
            return area ? area.width / 7 - 1 : 18;
          },
          height: (ctx: unknown) => {
            const area = (ctx as { chart?: { chartArea?: { height: number } } })
              ?.chart?.chartArea;
            return area ? area.height / 24 - 1 : 18;
          },
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
          label: (context: unknown) => {
            const v = (context as { raw?: HeatmapCell }).raw;
            return `${v?.x ?? ''} ${v?.y ?? ''}:00 - ${v?.v ?? 0} Reps`;
          },
        },
      },
      // chartjs-plugin-datalabels is referenced via options in this project.
      datalabels: {
        display: (ctx: unknown) => {
          const raw = (
            ctx as { dataset?: { data?: HeatmapCell[] }; dataIndex?: number }
          )?.dataset?.data?.[(ctx as { dataIndex: number }).dataIndex];
          return !!raw && typeof raw.v === 'number' && raw.v > 0;
        },
        formatter: (value: HeatmapCell) => (value?.v ? String(value.v) : ''),
        anchor: 'center',
        align: 'center',
        clamp: true,
        color: () => 'rgba(230,237,249,0.95)',
        font: (ctx: unknown) => {
          const raw = (
            ctx as { dataset?: { data?: HeatmapCell[] }; dataIndex?: number }
          )?.dataset?.data?.[(ctx as { dataIndex: number }).dataIndex];
          const v = typeof raw?.v === 'number' ? raw.v : 0;
          return { size: v >= 10 ? 11 : 10, weight: 700 };
        },
      },
      // chartjs-plugin-datalabels typings are not included in ChartConfiguration by default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
