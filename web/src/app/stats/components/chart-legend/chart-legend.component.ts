import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/**
 * One entry of a {@link ChartLegendComponent}. `active` drives the
 * marker: filled while the series is drawn, a hollow ring once the user
 * switched it off.
 */
export interface ChartLegendItem {
  id: string;
  label: string;
  color: string;
  active: boolean;
  /** Optional `data-testid` so callers keep their own naming scheme. */
  testId?: string;
}

/**
 * Clickable chart legend. Every entry is a `role="switch"` button, so
 * the legend that explains the colours is also the control that hides
 * and shows them — no separate checkbox row above the chart.
 *
 * Clicks stop propagating: the dashboard teaser wraps its chart in a
 * card that navigates on click, and toggling a series there must not
 * also leave the page.
 */
@Component({
  selector: 'app-chart-legend',
  imports: [],
  template: `
    <div
      class="legend"
      role="group"
      [attr.aria-label]="ariaLabel()"
      [attr.data-testid]="testId()"
    >
      @for (item of items(); track item.id) {
        <button
          type="button"
          class="item"
          role="switch"
          [class.off]="!item.active"
          [attr.aria-checked]="item.active"
          [attr.data-testid]="item.testId ?? null"
          (click)="onToggle($event, item.id)"
        >
          <i
            class="dot"
            [style.border-color]="item.color"
            [style.background]="item.active ? item.color : 'transparent'"
          ></i>
          <span>{{ item.label }}</span>
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 2px 8px;
    }
    .item {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 32px;
      padding: 2px 6px;
      margin: 0;
      border: 0;
      border-radius: 8px;
      background: none;
      color: inherit;
      font: inherit;
      line-height: 1.2;
      cursor: pointer;
    }
    .item:hover {
      background: rgba(148, 163, 184, 0.16);
    }
    .item:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 1px;
    }
    .off {
      opacity: 0.6;
    }
    .dot {
      flex: none;
      box-sizing: border-box;
      width: 11px;
      height: 11px;
      border-radius: 999px;
      border: 2px solid transparent;
    }
  `,
})
export class ChartLegendComponent {
  readonly items = input<ReadonlyArray<ChartLegendItem>>([]);
  readonly ariaLabel = input<string>('');
  readonly testId = input<string | null>(null);

  readonly itemToggle = output<string>();

  onToggle(event: Event, id: string): void {
    event.stopPropagation();
    this.itemToggle.emit(id);
  }
}
