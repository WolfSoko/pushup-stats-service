import { Component, computed, input, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';

export interface PieDatum {
  label: string;
  value: number;
  avgSetSize?: number;
}

export type PieSelectionMode = 'top5' | 'all' | 'custom';

const TOP_N = 5;

@Component({
  selector: 'app-type-pie',
  standalone: true,
  imports: [MatButtonToggleModule, MatCheckboxModule],
  template: `
    @if (total() > 0) {
      <div class="wrap">
        <div class="pie-area">
          <svg
            class="pie"
            viewBox="0 0 42 42"
            role="img"
            aria-label="Type distribution"
          >
            <circle class="bg" cx="21" cy="21" r="15.915" />

            @for (seg of visibleSegments(); track seg.label) {
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

          <mat-button-toggle-group
            class="mode-toggle"
            [value]="mode()"
            (change)="setMode($event.value)"
            aria-label="Auswahl"
            i18n-aria-label="@@pie.modeAria"
          >
            <mat-button-toggle value="top5" i18n="@@pie.top5"
              >Top 5</mat-button-toggle
            >
            <mat-button-toggle value="all" i18n="@@pie.all"
              >Alle</mat-button-toggle
            >
            <mat-button-toggle value="custom" i18n="@@pie.custom"
              >Auswahl</mat-button-toggle
            >
          </mat-button-toggle-group>
        </div>

        <div class="legend" data-testid="type-pie-legend">
          @for (seg of allSegments(); track seg.label) {
            <div class="row">
              <mat-checkbox
                color="primary"
                [checked]="isSelected(seg.label)"
                (change)="toggle(seg.label)"
                [attr.data-testid]="'type-pie-toggle-' + seg.label"
              >
                <span class="row-name">
                  <span class="dot" [style.background]="seg.color"></span>
                  <span class="name">{{ seg.label }}</span>
                </span>
              </mat-checkbox>
              <span class="pct">{{ seg.percent }}%</span>
            </div>
            @if (seg.avgSetSize) {
              <div class="row set-detail">
                <span class="set-label" i18n="@@pie.avgSetSize"
                  >&#x2300; Set-Gr&#x00F6;&#x00DF;e</span
                >
                <span class="set-value">{{ seg.avgSetSize }}</span>
              </div>
            }
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
      grid-template-columns: 200px 1fr;
      align-items: start;
      gap: 16px;
    }
    .pie-area {
      display: grid;
      gap: 10px;
      justify-items: center;
    }
    .pie {
      width: 160px;
      height: 160px;
      transform: rotate(-90deg);
    }
    .mode-toggle {
      font-size: 0.78rem;
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
      gap: 4px;
      min-width: 0;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
    }
    .row-name {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
      flex: 0 0 auto;
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
    .set-detail {
      opacity: 0.6;
      font-size: 0.8rem;
      grid-template-columns: 1fr auto;
      padding-left: 36px;
    }
    .set-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .set-value {
      font-variant-numeric: tabular-nums;
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

  readonly mode = signal<PieSelectionMode>('top5');
  private readonly customSelection = signal<ReadonlySet<string>>(new Set());

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

  readonly allSegments = computed(() => {
    const total = this.total();
    if (!total)
      return [] as Array<{
        label: string;
        value: number;
        percent: number;
        color: string;
        avgSetSize: number;
      }>;

    const rows = [...this.data()]
      .filter((x) => (x.value || 0) > 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    return rows.map((row, idx) => ({
      label: row.label,
      value: row.value || 0,
      percent: Math.round(((row.value || 0) / total) * 100),
      color: this.palette[idx % this.palette.length],
      avgSetSize: row.avgSetSize ?? 0,
    }));
  });

  readonly selectedLabels = computed<ReadonlySet<string>>(() => {
    const all = this.allSegments();
    const mode = this.mode();
    if (mode === 'top5') {
      return new Set(all.slice(0, TOP_N).map((s) => s.label));
    }
    if (mode === 'all') {
      return new Set(all.map((s) => s.label));
    }
    return this.customSelection();
  });

  readonly visibleSegments = computed(() => {
    const total = this.total();
    if (!total)
      return [] as Array<{
        label: string;
        percent: number;
        color: string;
        dasharray: string;
        offset: number;
      }>;

    const selected = this.selectedLabels();
    let acc = 0;
    return this.allSegments()
      .filter((s) => selected.has(s.label))
      .map((seg) => {
        const dash = (seg.value / total) * 100;
        const result = {
          label: seg.label,
          percent: seg.percent,
          color: seg.color,
          dasharray: `${dash} ${100 - dash}`,
          offset: 25 - acc,
        };
        acc += dash;
        return result;
      });
  });

  isSelected(label: string): boolean {
    return this.selectedLabels().has(label);
  }

  toggle(label: string): void {
    const next = new Set(this.selectedLabels());
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    this.customSelection.set(next);
    this.mode.set('custom');
  }

  setMode(value: PieSelectionMode): void {
    if (!value) return;
    this.mode.set(value);
  }
}
