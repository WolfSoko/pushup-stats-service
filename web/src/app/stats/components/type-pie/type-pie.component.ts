import { Component, computed, input } from '@angular/core';

export interface PieDatum {
  label: string;
  value: number;
}

@Component({
  selector: 'app-type-pie',
  standalone: true,
  template: `
    @if (total() > 0) {
      <div class="wrap">
        <svg
          class="pie"
          viewBox="0 0 42 42"
          role="img"
          aria-label="Type distribution"
        >
          <circle class="bg" cx="21" cy="21" r="15.915" />

          @for (seg of segments(); track seg.label) {
            <circle
              class="seg"
              cx="21"
              cy="21"
              r="15.915"
              [attr.stroke]="seg.color"
              [attr.stroke-dasharray]="seg.dasharray"
              [attr.stroke-dashoffset]="seg.offset"
            />
          }
        </svg>

        <div class="legend">
          @for (seg of segments(); track seg.label) {
            <div class="row">
              <span class="dot" [style.background]="seg.color"></span>
              <span class="name">{{ seg.label }}</span>
              <span class="pct">{{ seg.percent }}%</span>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="empty" i18n="@@pie.noData">Keine Daten</div>
    }
  `,
  styles: `
    .wrap {
      display: grid;
      grid-template-columns: 160px 1fr;
      align-items: center;
      gap: 16px;
    }
    .pie {
      width: 160px;
      height: 160px;
      transform: rotate(-90deg);
    }
    .bg {
      fill: none;
      stroke: rgba(0, 0, 0, 0.08);
      stroke-width: 10;
    }
    .seg {
      fill: none;
      stroke-width: 10;
      stroke-linecap: butt;
    }

    .legend {
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    .row {
      display: grid;
      grid-template-columns: 14px 1fr auto;
      gap: 10px;
      align-items: center;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pct {
      font-variant-numeric: tabular-nums;
      opacity: 0.8;
    }
    .empty {
      opacity: 0.7;
    }

    @media (max-width: 600px) {
      .wrap {
        grid-template-columns: 1fr;
      }
      .pie {
        margin: 0 auto;
      }
    }
  `,
})
export class TypePieComponent {
  readonly data = input<PieDatum[]>([]);

  readonly total = computed(() =>
    this.data().reduce((sum, x) => sum + (x.value || 0), 0)
  );

  private readonly palette = [
    '#1976d2', // blue
    '#9c27b0', // purple
    '#2e7d32', // green
    '#ef6c00', // orange
    '#d32f2f', // red
    '#00838f', // teal
    '#5d4037', // brown
    '#455a64', // blue grey
  ];

  readonly segments = computed(() => {
    const total = this.total();
    if (!total)
      return [] as Array<{
        label: string;
        percent: number;
        color: string;
        dasharray: string;
        offset: number;
      }>;

    // Sort descending for stable, readable legend.
    const rows = [...this.data()]
      .filter((x) => (x.value || 0) > 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // We use a 100-unit circumference convention.
    let acc = 0;
    return rows.map((row, idx) => {
      const percent = Math.round(((row.value || 0) / total) * 100);
      const dash = (row.value / total) * 100;
      const seg = {
        label: row.label,
        percent,
        color: this.palette[idx % this.palette.length],
        dasharray: `${dash} ${100 - dash}`,
        offset: 25 - acc,
      };
      acc += dash;
      return seg;
    });
  });
}
