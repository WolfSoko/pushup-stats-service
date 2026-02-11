import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { StatsGranularity, StatsSeriesEntry } from '@nx-temp/stats-models';

@Component({
  selector: 'app-stats-table',
  imports: [MatCardModule, DatePipe],
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
                <td>
                  {{ row.bucket | date: (granularity() === 'hourly' ? 'dd.MM., HH:mm' : 'dd.MM.yyyy') }}
                </td>
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
}
