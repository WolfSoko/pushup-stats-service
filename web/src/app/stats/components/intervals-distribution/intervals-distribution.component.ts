import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';
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
      <div
        class="bars"
        role="list"
        aria-label="Intervall-Verteilung"
        i18n-aria-label="@@intervalsDistribution.listLabel"
      >
        @for (d of data(); track d.value) {
          <div
            class="bar-row"
            role="listitem"
            [attr.aria-label]="ariaLabelFor(d)"
          >
            <span class="label" aria-hidden="true">{{
              formatValue(d.value)
            }}</span>
            <div class="bar-track" aria-hidden="true">
              <div class="bar-fill" [style.width.%]="barWidth(d.count)"></div>
            </div>
            <span class="value" aria-hidden="true">{{ d.percent }}%</span>
          </div>
        }
      </div>
    } @else {
      <div class="empty" i18n="@@intervalsDistribution.noData">
        Keine Intervall-Daten vorhanden
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  // Normalise bar widths against the largest bin's raw count, not its
  // rounded display percent. With >100 unique interval values (sprint
  // sessions with many distinct distances), every bin's percent rounds
  // to 0 and a percent-based normaliser collapses every bar to width 0.
  private readonly maxCount = computed(() =>
    this.data().reduce((max, d) => Math.max(max, d.count), 0)
  );

  barWidth(count: number): number {
    const max = this.maxCount();
    if (max <= 0) return 0;
    return (count / max) * 100;
  }

  formatValue(value: number): string {
    const measurement: MeasurementType = this.measurement();
    if (measurement === 'time') return formatSeconds(value);
    return formatMeters(value);
  }

  ariaLabelFor(d: IntervalsDistributionDatum): string {
    return `${this.formatValue(d.value)}: ${d.count} (${d.percent}%)`;
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
    // toFixed(1) keeps the unit visually consistent at the boundary:
    // 1000 m → "1.0 km" (not "1 km"), 1050 m → "1.1 km". Without the
    // trailing zero the boundary bar looks like a different unit
    // class than its neighbour.
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}
