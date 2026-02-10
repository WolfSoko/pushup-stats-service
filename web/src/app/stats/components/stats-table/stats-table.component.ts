import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { StatsGranularity, StatsSeriesEntry } from '@nx-temp/stats-models';

@Component({
  selector: 'app-stats-table',
  imports: [MatCardModule],
  template: `
    <mat-card class="table-card">
      <div class="table-header">
        <h2>{{ granularity() === 'hourly' ? 'Stundenwerte' : 'Tageswerte' }}</h2>
        <p>{{ rows().length }} Datensätze</p>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ granularity() === 'hourly' ? 'Zeit' : 'Datum' }}</th>
              <th>Liegestütze</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.bucket) {
              <tr>
                <td>{{ formatBucket(row.bucket) }}</td>
                <td>{{ row.total }}</td>
              </tr>
            }
            @if (!rows().length) {
              <tr>
                <td colspan="2" class="empty">Keine Daten im gewählten Zeitraum.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </mat-card>
  `,
  styleUrl: './stats-table.component.scss',
})
export class StatsTableComponent {
  readonly rows = input<StatsSeriesEntry[]>([]);
  readonly granularity = input<StatsGranularity>('daily');

  formatBucket(bucket: string): string {
    if (this.granularity() === 'hourly') {
      return new Date(`${bucket}:00`).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return new Date(bucket).toLocaleDateString('de-DE');
  }
}
