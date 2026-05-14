import { Component, computed, input } from '@angular/core';
import {
  type MeasurementType,
  type UnifiedEntry,
  unifiedEntryMeasurement,
} from '@pu-stats/models';

export type IntervalsDistributionMeasurement =
  | 'time'
  | 'distance'
  | 'distance-time';

export interface IntervalsDistributionDatum {
  value: number;
  count: number;
  percent: number;
}

@Component({
  selector: 'app-intervals-distribution',
  standalone: true,
  template: `
    @if (data().length) {
      <div class="bars">
        @for (d of data(); track d.value) {
          <div class="bar-row">
            <span class="label">{{ formatValue(d.value) }}</span>
            <div class="bar-track">
              <div class="bar-fill" [style.width.%]="barWidth(d.percent)"></div>
            </div>
            <span class="value">{{ d.percent }}%</span>
          </div>
        }
      </div>
    } @else {
      <div class="empty" i18n="@@intervalsDistribution.noData">
        Keine Intervall-Daten vorhanden
      </div>
    }
  `,
  styles: `
    .bars {
      display: grid;
      gap: 8px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: 64px 1fr 48px;
      gap: 8px;
      align-items: center;
    }
    .label {
      font-variant-numeric: tabular-nums;
      text-align: right;
      opacity: 0.8;
      font-size: 0.85rem;
    }
    .bar-track {
      height: 20px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 4px;
      overflow: hidden;
    }
    :host-context(html.light-theme) .bar-track {
      background: rgba(15, 23, 42, 0.08);
    }
    .bar-fill {
      height: 100%;
      background: #5e8eff;
      border-radius: 4px;
      min-width: 2px;
      transition: width 0.3s ease;
    }
    .value {
      font-variant-numeric: tabular-nums;
      font-size: 0.85rem;
      opacity: 0.8;
    }
    .empty {
      opacity: 0.7;
    }
  `,
})
export class IntervalsDistributionComponent {
  readonly entries = input<readonly UnifiedEntry[]>([]);
  readonly measurement = input.required<IntervalsDistributionMeasurement>();

  readonly data = computed<IntervalsDistributionDatum[]>(() => {
    const target = this.measurement();
    const values: number[] = [];
    for (const entry of this.entries()) {
      if (unifiedEntryMeasurement(entry) !== target) continue;
      const intervals = entry.intervals;
      if (!intervals?.length) continue;
      values.push(...intervals);
    }
    if (!values.length) return [];

    const byValue = new Map<number, number>();
    for (const v of values) {
      byValue.set(v, (byValue.get(v) ?? 0) + 1);
    }
    const total = values.length;
    return [...byValue.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([value, count]) => ({
        value,
        count,
        percent: Math.round((count / total) * 100),
      }));
  });

  barWidth(percent: number): number {
    return percent;
  }

  formatValue(value: number): string {
    const measurement: MeasurementType = this.measurement();
    if (measurement === 'time') return formatSeconds(value);
    return formatMeters(value);
  }
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

function formatMeters(meters: number): string {
  if (meters >= 1000) {
    const km = Math.round(meters / 100) / 10;
    return `${km} km`;
  }
  return `${meters} m`;
}
