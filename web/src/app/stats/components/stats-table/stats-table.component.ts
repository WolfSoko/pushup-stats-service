import { DatePipe } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { PushupRecord } from '@nx-temp/stats-models';

@Component({
  selector: 'app-stats-table',
  imports: [MatCardModule, DatePipe],
  template: `
    <mat-card class="table-card">
      <div class="table-header">
        <h2>Einträge (CRUD)</h2>
        <p>{{ entries().length }} Einträge</p>
      </div>

      <form class="create-row" (submit)="submitCreate($event)">
        <input type="datetime-local" [value]="newTimestamp()" (input)="newTimestamp.set(asValue($event))" required />
        <input
          type="number"
          min="1"
          [value]="newReps()"
          (input)="newReps.set(asValue($event))"
          placeholder="Reps"
          required
        />
        <input type="text" [value]="newSource()" (input)="newSource.set(asValue($event))" placeholder="Quelle" />
        <button type="submit">Neu</button>
      </form>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Reps</th>
              <th>Quelle</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of entries(); track entry._id) {
              <tr>
                <td>{{ entry.timestamp | date: 'dd.MM.yyyy, HH:mm' }}</td>
                <td>
                  <input
                    type="number"
                    min="1"
                    [value]="editReps(entry)"
                    (input)="setEditReps(entry, asValue($event))"
                  />
                </td>
                <td>
                  <input type="text" [value]="editSource(entry)" (input)="setEditSource(entry, asValue($event))" />
                </td>
                <td class="actions">
                  <button type="button" (click)="save(entry)">Speichern</button>
                  <button type="button" class="danger" (click)="remove.emit(entry._id)">Löschen</button>
                </td>
              </tr>
            }
            @if (!entries().length) {
              <tr>
                <td colspan="4" class="empty">Keine Einträge im gewählten Zeitraum.</td>
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
  readonly entries = input<PushupRecord[]>([]);

  readonly create = output<{ timestamp: string; reps: number; source?: string }>();
  readonly update = output<{ id: string; reps: number; source: string }>();
  readonly remove = output<string>();

  readonly newTimestamp = signal('');
  readonly newReps = signal('');
  readonly newSource = signal('web');

  private readonly editedReps = signal<Record<string, string>>({});
  private readonly editedSource = signal<Record<string, string>>({});

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  editReps(entry: PushupRecord): string {
    return this.editedReps()[entry._id] ?? String(entry.reps);
  }

  editSource(entry: PushupRecord): string {
    return this.editedSource()[entry._id] ?? entry.source;
  }

  setEditReps(entry: PushupRecord, value: string): void {
    this.editedReps.update((prev) => ({ ...prev, [entry._id]: value }));
  }

  setEditSource(entry: PushupRecord, value: string): void {
    this.editedSource.update((prev) => ({ ...prev, [entry._id]: value }));
  }

  submitCreate(event: Event): void {
    event.preventDefault();
    const reps = Number(this.newReps());
    if (!this.newTimestamp() || Number.isNaN(reps) || reps <= 0) return;

    this.create.emit({
      timestamp: this.newTimestamp(),
      reps,
      source: this.newSource() || 'web',
    });

    this.newReps.set('');
  }

  save(entry: PushupRecord): void {
    const reps = Number(this.editReps(entry));
    if (Number.isNaN(reps) || reps <= 0) return;
    this.update.emit({
      id: entry._id,
      reps,
      source: this.editSource(entry) || 'web',
    });
  }
}
