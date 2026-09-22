import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';
import { SkeletonComponent } from './skeleton.component';

const BAR_WIDTHS = ['85%', '60%', '72%', '48%', '66%'];

/** Placeholder rows for a table or list that has not loaded yet. */
@Component({
  selector: 'pu-skeleton-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  host: { 'aria-hidden': 'true', class: 'pu-skeleton-table' },
  template: `
    @for (row of rowIndexes(); track row) {
      <div
        class="pu-skeleton-table__row"
        [style.grid-template-columns]="columnTemplate()"
      >
        @for (column of columnIndexes(); track column) {
          <pu-skeleton [width]="barWidth(row, column)" />
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .pu-skeleton-table__row {
      display: grid;
      align-items: center;
      gap: 16px;
      min-height: 48px;
      padding: 0 16px;
      border-bottom: 1px solid var(--border-subtle, rgba(128, 128, 128, 0.2));
    }
    .pu-skeleton-table__row:last-child {
      border-bottom: none;
    }
  `,
})
export class SkeletonTableComponent {
  readonly rows = input(5, { transform: numberAttribute });
  readonly columns = input(4, { transform: numberAttribute });

  protected readonly rowIndexes = computed(() =>
    Array.from({ length: Math.max(1, this.rows()) }, (_, index) => index)
  );
  protected readonly columnIndexes = computed(() =>
    Array.from({ length: Math.max(1, this.columns()) }, (_, index) => index)
  );
  protected readonly columnTemplate = computed(
    () => `repeat(${Math.max(1, this.columns())}, minmax(0, 1fr))`
  );

  protected barWidth(row: number, column: number): string {
    return BAR_WIDTHS[(row + column) % BAR_WIDTHS.length];
  }
}
