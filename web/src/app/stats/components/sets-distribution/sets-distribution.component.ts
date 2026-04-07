import { Component, computed, input } from '@angular/core';

export interface SetsDistributionDatum {
  setCount: number;
  count: number;
  percent: number;
}

@Component({
  selector: 'app-sets-distribution',
  standalone: true,
  template: `
    @if (data().length) {
      <div class="bars">
        @for (d of data(); track d.setCount) {
          <div class="bar-row">
            <span class="label">{{ d.setCount }}</span>
            <div class="bar-track">
              <div class="bar-fill" [style.width.%]="barWidth(d.percent)"></div>
            </div>
            <span class="value">{{ d.percent }}%</span>
          </div>
        }
      </div>
    } @else {
      <div class="empty" i18n="@@setsDistribution.noData">
        Keine Sets-Daten vorhanden
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
      grid-template-columns: 28px 1fr 48px;
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
export class SetsDistributionComponent {
  readonly data = input<SetsDistributionDatum[]>([]);

  private readonly maxPercent = computed(() =>
    Math.max(1, ...this.data().map((d) => d.percent))
  );

  barWidth(percent: number): number {
    return (percent / this.maxPercent()) * 100;
  }
}
