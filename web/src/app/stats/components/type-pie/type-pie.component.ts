import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import type { PieDatum } from './type-pie.models';
import {
  buildAllSegments,
  buildArcSegments,
  percentOfSelected,
  pieTotal,
  selectedTotal,
  setsEqual,
  topNIds,
} from './type-pie-data';

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
              role="group"
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
              @if (isSelected(seg.id)) {
                <span class="pct">{{ legendPercent(seg.id) ?? 0 }}%</span>
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
  styleUrl: './type-pie.component.scss',
})
export class TypePieComponent {
  readonly data = input<PieDatum[]>([]);

  // null = use top-5 default; concrete Set = explicit user choice (may be empty).
  private readonly userSelection = signal<ReadonlySet<string> | null>(null);
  private readonly _focusedId = signal<string | null>(null);
  // Effective focused id — `null` whenever the raw focus no longer maps
  // to a visible segment (e.g. after the parent swaps `data` and evicts
  // it). The template reads this so dimming/focused styling can't get
  // stuck on a stale id.
  readonly focusedId = computed<string | null>(
    () => this.focusedSegment()?.id ?? null
  );

  readonly total = computed(() => pieTotal(this.data()));

  readonly allSegments = computed(() => buildAllSegments(this.data()));

  readonly topFiveIds = computed<ReadonlySet<string>>(() =>
    topNIds(this.allSegments())
  );

  readonly selectedIds = computed<ReadonlySet<string>>(() => {
    const explicit = this.userSelection();
    if (explicit !== null) return explicit;
    return this.topFiveIds();
  });

  readonly isTopFiveActive = computed(() =>
    setsEqual(this.selectedIds(), this.topFiveIds())
  );

  /**
   * Sum of values across the currently selected types — defines the 100%
   * reference used by the pie and legend percentages so the rendered pie
   * has no Other arc when types are excluded.
   */
  readonly selectedTotal = computed(() =>
    selectedTotal(this.allSegments(), this.selectedIds())
  );

  readonly visibleSegments = computed(() =>
    buildArcSegments(this.allSegments(), this.selectedIds())
  );

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
    return percentOfSelected(this.allSegments(), this.selectedIds(), id);
  }
}
