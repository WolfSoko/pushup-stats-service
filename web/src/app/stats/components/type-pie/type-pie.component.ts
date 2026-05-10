import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';

export interface PieDatum {
  /**
   * Stable, locale-independent identifier used for selection state and
   * test selectors. Defaults to `label` when omitted, but production
   * callers should pass a canonical key (e.g. the canonical pushup
   * type id) so checkbox state and `data-testid` survive locale
   * switches and labels with spaces/diacritics.
   */
  id?: string;
  label: string;
  value: number;
  avgSetSize?: number;
}

const TOP_N = 5;

@Component({
  selector: 'app-type-pie',
  standalone: true,
  imports: [DecimalPipe, MatCheckboxModule],
  template: `
    @if (total() > 0) {
      <div class="wrap">
        <div class="pie-area">
          <div class="pie-stack">
            <svg
              class="pie"
              viewBox="0 0 42 42"
              role="img"
              aria-label="Verteilung der Liegestütz-Typen"
              i18n-aria-label="@@pie.distributionAria"
            >
              <circle class="bg" cx="21" cy="21" r="15.915" />

              @for (seg of visibleSegments(); track seg.id) {
                <circle
                  class="seg"
                  [class.focused]="focusedId() === seg.id"
                  [class.dimmed]="
                    focusedId() !== null && focusedId() !== seg.id
                  "
                  cx="21"
                  cy="21"
                  r="15.915"
                  [attr.stroke]="seg.color"
                  [attr.stroke-dasharray]="seg.dasharray"
                  [attr.stroke-dashoffset]="seg.offset"
                  tabindex="0"
                  role="button"
                  [attr.aria-label]="
                    seg.label + ': ' + seg.value + ' (' + seg.percent + '%)'
                  "
                  [attr.aria-pressed]="focusedId() === seg.id"
                  [attr.data-testid]="'type-pie-slice-' + seg.id"
                  (click)="focusSegment(seg.id)"
                  (keydown.enter)="focusSegment(seg.id)"
                  (keydown.space)="
                    focusSegment(seg.id); $event.preventDefault()
                  "
                />
              }
            </svg>

            <div class="pie-center" data-testid="type-pie-center">
              @if (selectedTotal() === 0) {
                <span class="center-label" i18n="@@pie.noSelection"
                  >Keine Auswahl</span
                >
              } @else if (focusedSegment(); as f) {
                <span
                  class="center-label"
                  data-testid="type-pie-focused-label"
                  >{{ f.label }}</span
                >
                <span
                  class="center-value"
                  data-testid="type-pie-focused-value"
                  >{{ f.value | number }}</span
                >
                <span class="center-pct" data-testid="type-pie-focused-percent"
                  >{{ f.percent }}%</span
                >
              } @else {
                <span class="center-label" i18n="@@pie.totalLabel">Gesamt</span>
                <span class="center-value" data-testid="type-pie-total">{{
                  selectedTotal() | number
                }}</span>
              }
            </div>
          </div>
        </div>

        <div class="legend" data-testid="type-pie-legend">
          <div class="row preset-row">
            <mat-checkbox
              color="primary"
              [checked]="isTopFiveActive()"
              (change)="onTopFiveChange($event.checked)"
              data-testid="type-pie-top5"
            >
              <span class="row-name">
                <span class="name preset-name" i18n="@@pie.top5">Top 5</span>
              </span>
            </mat-checkbox>
          </div>
          @for (seg of allSegments(); track seg.id) {
            <div class="row">
              <mat-checkbox
                color="primary"
                [checked]="isSelected(seg.id)"
                (change)="toggle(seg.id)"
                [attr.data-testid]="'type-pie-toggle-' + seg.id"
              >
                <span class="row-name">
                  <span class="dot" [style.background]="seg.color"></span>
                  <span class="name">{{ seg.label }}</span>
                </span>
              </mat-checkbox>
              @if (legendPercent(seg.id); as pct) {
                <span class="pct">{{ pct }}%</span>
              } @else {
                <span class="pct count">{{ seg.value | number }}</span>
              }
            </div>
            @if (seg.avgSetSize) {
              <div class="row set-detail">
                <span class="set-label" i18n="@@pie.avgSetSize"
                  >&#x2300; Set-Gr&#x00F6;&#x00DF;e</span
                >
                <span class="set-value">{{
                  seg.avgSetSize | number: '1.0-1'
                }}</span>
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
    .pie-stack {
      position: relative;
      width: 160px;
      height: 160px;
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
      cursor: pointer;
      transition:
        stroke-width 0.15s ease,
        opacity 0.15s ease;
    }
    .seg:hover,
    .seg:focus-visible,
    .seg.focused {
      stroke-width: 12;
      outline: none;
    }
    .seg.dimmed {
      opacity: 0.45;
    }
    .pie-center {
      position: absolute;
      inset: 0;
      display: grid;
      align-content: center;
      justify-items: center;
      text-align: center;
      pointer-events: none;
      padding: 18%;
      gap: 2px;
    }
    .center-label {
      font-size: 0.72rem;
      opacity: 0.75;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .center-value {
      font-size: 1.25rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }
    .center-pct {
      font-size: 0.85rem;
      opacity: 0.85;
      font-variant-numeric: tabular-nums;
    }

    .legend {
      display: grid;
      gap: 4px;
      min-width: 0;
      max-height: 220px;
      overflow-y: auto;
      padding-right: 4px;
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
    .pct.count {
      opacity: 0.5;
    }
    .set-detail {
      opacity: 0.6;
      font-size: 0.8rem;
      grid-template-columns: 1fr auto;
      padding-left: 36px;
    }
    .preset-row {
      position: sticky;
      top: 0;
      z-index: 1;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      background: var(--mat-sys-surface, #fff);
    }
    .preset-name {
      font-weight: 600;
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
      .pie-stack {
        margin: 0 auto;
      }
    }
  `,
})
export class TypePieComponent {
  readonly data = input<PieDatum[]>([]);

  // null = use top-5 default; concrete Set = explicit user choice (may be empty).
  private readonly userSelection = signal<ReadonlySet<string> | null>(null);
  private readonly _focusedId = signal<string | null>(null);
  readonly focusedId = this._focusedId.asReadonly();

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
        id: string;
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
      id: row.id ?? row.label,
      label: row.label,
      value: row.value || 0,
      percent: Math.round(((row.value || 0) / total) * 100),
      color: this.palette[idx % this.palette.length],
      avgSetSize: row.avgSetSize ?? 0,
    }));
  });

  readonly topFiveIds = computed<ReadonlySet<string>>(
    () =>
      new Set(
        this.allSegments()
          .slice(0, TOP_N)
          .map((s) => s.id)
      )
  );

  readonly selectedIds = computed<ReadonlySet<string>>(() => {
    const explicit = this.userSelection();
    if (explicit !== null) return explicit;
    return this.topFiveIds();
  });

  readonly isTopFiveActive = computed(() => {
    const selected = this.selectedIds();
    const top = this.topFiveIds();
    if (selected.size !== top.size) return false;
    for (const id of top) {
      if (!selected.has(id)) return false;
    }
    return true;
  });

  /**
   * Sum of values across the currently selected types — defines the 100%
   * reference used by the pie and legend percentages so the rendered pie
   * has no Other arc when types are excluded.
   */
  readonly selectedTotal = computed(() => {
    const selected = this.selectedIds();
    return this.allSegments()
      .filter((s) => selected.has(s.id))
      .reduce((sum, s) => sum + s.value, 0);
  });

  readonly visibleSegments = computed(() => {
    const selectedTotal = this.selectedTotal();
    if (!selectedTotal)
      return [] as Array<{
        id: string;
        label: string;
        value: number;
        percent: number;
        color: string;
        avgSetSize: number;
        dasharray: string;
        offset: number;
      }>;

    const selected = this.selectedIds();
    let acc = 0;
    return this.allSegments()
      .filter((s) => selected.has(s.id))
      .map((seg) => {
        const dash = (seg.value / selectedTotal) * 100;
        const result = {
          id: seg.id,
          label: seg.label,
          value: seg.value,
          percent: Math.round((seg.value / selectedTotal) * 100),
          color: seg.color,
          avgSetSize: seg.avgSetSize,
          dasharray: `${dash} ${100 - dash}`,
          offset: 25 - acc,
        };
        acc += dash;
        return result;
      });
  });

  readonly focusedSegment = computed(() => {
    const id = this._focusedId();
    if (!id) return null;
    return this.visibleSegments().find((s) => s.id === id) ?? null;
  });

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(id)) {
      next.delete(id);
      if (this._focusedId() === id) this._focusedId.set(null);
    } else {
      next.add(id);
    }
    this.userSelection.set(next);
  }

  onTopFiveChange(checked: boolean): void {
    if (checked) {
      this.userSelection.set(new Set(this.topFiveIds()));
    } else {
      this.userSelection.set(new Set(this.allSegments().map((s) => s.id)));
    }
    const fid = this._focusedId();
    if (fid && !this.selectedIds().has(fid)) this._focusedId.set(null);
  }

  focusSegment(id: string): void {
    this._focusedId.set(this._focusedId() === id ? null : id);
  }

  /** Percent of the selected total — `null` for unselected rows. */
  legendPercent(id: string): number | null {
    if (!this.selectedIds().has(id)) return null;
    const total = this.selectedTotal();
    if (total <= 0) return null;
    const seg = this.allSegments().find((s) => s.id === id);
    if (!seg) return null;
    return Math.round((seg.value / total) * 100);
  }
}
