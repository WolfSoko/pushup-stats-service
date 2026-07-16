import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  PLATFORM_ID,
  computed,
  inject,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts } from 'ng2-charts';
import { ensureHeatmapChartRegistered } from './chart-setup';
import {
  buildHeatmapCells,
  defaultHeatmapDays,
  defaultHeatmapHoursTopDown,
  formatHeatmapCellLabel,
  formatHeatmapTooltipValue,
  heatmapCellColor,
  type HeatmapMeasurement,
  type HeatmapMode,
} from './heatmap.utils';

/** Minimal shape the heatmap reads — narrower than `PushupRecord` or
 *  `UnifiedEntry` so both can be passed in without a union type at the
 *  caller. `buildHeatmapCells` already requires only these fields. */
export interface HeatmapEntry {
  timestamp: string;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
  sets?: number[];
  intervals?: number[];
}

ensureHeatmapChartRegistered();

export interface HeatmapCell {
  x: string; // weekday label
  y: string; // hour label
  v: number; // aggregated value (reps / durationSec / distanceM / count)
}

@Component({
  selector: 'app-heatmap',
  standalone: true,
  imports: [BaseChartDirective],
  providers: [provideCharts()],
  template: `
    @if (isBrowser) {
      <canvas
        baseChart
        [data]="chartData()"
        [options]="chartOptions()"
        [type]="'matrix'"
      ></canvas>
    } @else {
      <div class="ssr-note" i18n="@@heatmap.loading">
        Heatmap wird im Browser geladen…
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  readonly entries = input<ReadonlyArray<HeatmapEntry>>([]);
  readonly measurement = input<HeatmapMeasurement | null>('reps');
  readonly mode = input<HeatmapMode>('primary');

  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly days = defaultHeatmapDays;
  private readonly hoursTopDown = defaultHeatmapHoursTopDown;

  private readonly unitLabel = computed(() => {
    const m = this.measurement() ?? 'mixed';
    if (this.mode() === 'breakdown') {
      if (m === 'reps' || m === 'weight') {
        return $localize`:@@heatmap.unit.sets:Sätze`;
      }
      if (m === 'mixed') {
        return $localize`:@@heatmap.unit.entries:Einträge`;
      }
      return $localize`:@@heatmap.unit.intervals:Intervalle`;
    }
    switch (m) {
      // `formatHeatmapTooltipValue` already embeds the unit for time
      // (`2:30 min`, `1:02:05 h`) and distance (`750 m`, `5.00 km`) —
      // appending another suffix would render `2:30 min min`.
      case 'time':
      case 'distance':
      case 'distance-time':
        return '';
      case 'mixed':
        return $localize`:@@heatmap.unit.entries:Einträge`;
      case 'reps':
      case 'weight':
        return $localize`:@@heatmap.unit.reps:Wiederholungen`;
    }
  });

  // Matrix chart typing is tricky with string category axes; keep this loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly chartData = computed<any>(() => {
    const data = buildHeatmapCells({
      entries: this.entries(),
      days: this.days,
      hoursTopDown: this.hoursTopDown,
      measurement: this.measurement() ?? 'mixed',
      mode: this.mode(),
    });

    const max = Math.max(0, ...data.map((d) => d.v)) || 1;

    return {
      datasets: [
        {
          label: 'Heatmap',
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
  readonly chartOptions = computed<ChartConfiguration['options']>(() => {
    const unit = this.unitLabel();
    const measurement = this.measurement() ?? 'mixed';
    const mode = this.mode();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: () => '',
            label: (context: unknown) => {
              const v = (context as { raw?: HeatmapCell }).raw;
              const formatted = formatHeatmapTooltipValue({
                value: v?.v ?? 0,
                measurement,
                mode,
              });
              const suffix = unit ? ` ${unit}` : '';
              return `${v?.x ?? ''} ${v?.y ?? ''}:00 - ${formatted}${suffix}`;
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
          formatter: (value: HeatmapCell) =>
            formatHeatmapCellLabel({
              value: value?.v ?? 0,
              measurement,
              mode,
            }),
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
  });
}
