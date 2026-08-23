import { DecimalPipe } from '@angular/common';
import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import type { TrendPoint } from '../analysis/analysis.types';
import type { SegmentMeasurement } from '../analysis/measurement-groups';
import { formatSegmentCell } from './analysis-segment.helpers';

/**
 * One fixed-window trend table (8 weeks or 6 months) for a single
 * measurement. The value column is headed by the dimension's name and
 * its cells carry that dimension's unit, so a block of planks reads
 * `3:00` under "Dauer" instead of seconds under "Reps".
 */
@Component({
  selector: 'app-analysis-trend-table',
  imports: [DecimalPipe, MatCardModule, MatTableModule],
  templateUrl: './analysis-trend-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    mat-table {
      width: 100%;
    }
    mat-card-content {
      overflow: auto;
    }
    /* Reserve roughly the rendered table height so revealing the
       deferred block doesn't shift the rest of the page down. */
    .trend-placeholder {
      min-height: 320px;
    }
  `,
})
export class AnalysisTrendTableComponent {
  readonly rows = input.required<TrendPoint[]>();
  readonly measurement = input.required<SegmentMeasurement>();
  /** Dimension name — doubles as the value column header. */
  readonly valueLabel = input.required<string>();
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly periodLabel = input.required<string>();
  /** Sets only exist on rep-measured entries; other blocks drop the column. */
  readonly showSets = input<boolean>(false);

  readonly periodColumn = 'label';

  columns(): string[] {
    return this.showSets()
      ? ['label', 'total', 'avgSetsPerEntry']
      : ['label', 'total'];
  }

  formatValue(value: number): string {
    return formatSegmentCell(value, this.measurement());
  }
}
