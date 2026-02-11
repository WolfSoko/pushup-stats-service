import { DatePipe } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PushupRecord } from '@nx-temp/stats-models';

@Component({
  selector: 'app-stats-table',
  imports: [MatCardModule, MatProgressSpinnerModule, DatePipe],
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
        <button type="submit" [disabled]="isCreateBusy()">
          @if (isCreateBusy()) {
            <mat-spinner diameter="14"></mat-spinner>
          } @else {
            Neu
          }
        </button>
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
                  @if (isEditing(entry._id)) {
                    <input
                      type="number"
                      min="1"
                      [value]="editReps(entry)"
                      (input)="setEditReps(entry, asValue($event))"
                    />
                  } @else {
                    <span>{{ entry.reps }}</span>
                  }
                </td>
                <td>
                  @if (isEditing(entry._id)) {
                    <input type="text" [value]="editSource(entry)" (input)="setEditSource(entry, asValue($event))" />
                  } @else {
                    <span>{{ entry.source }}</span>
                  }
                </td>
                <td class="actions">
                  @if (isEditing(entry._id)) {
                    <button
                      type="button"
                      aria-label="Speichern"
                      title="Speichern"
                      [disabled]="isBusy('update', entry._id)"
                      (click)="save(entry)"
                    >
                      @if (isBusy('update', entry._id)) {
                        <mat-spinner diameter="14"></mat-spinner>
                      } @else {
                        💾
                      }
                    </button>
                    <button type="button" aria-label="Abbrechen" title="Abbrechen" [disabled]="isBusy('update', entry._id)" (click)="cancelEdit()">✖️</button>
                  } @else {
                    <button type="button" aria-label="Edit" title="Edit" (click)="startEdit(entry)">✏️</button>
                  }
                  <button
                    type="button"
                    class="danger"
                    aria-label="Löschen"
                    title="Löschen"
                    [disabled]="isBusy('delete', entry._id)"
                    (click)="remove.emit(entry._id)"
                  >
                    @if (isBusy('delete', entry._id)) {
                      <mat-spinner diameter="14"></mat-spinner>
                    } @else {
                      🗑️
                    }
                  </button>
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
  readonly busyAction = input<'create' | 'update' | 'delete' | null>(null);
  readonly busyId = input<string | null>(null);

  readonly create = output<{ timestamp: string; reps: number; source?: string }>();
  readonly update = output<{ id: string; reps: number; source: string }>();
  readonly remove = output<string>();

  readonly newTimestamp = signal('');
  readonly newReps = signal('');
  readonly newSource = signal('web');

  private readonly editedReps = signal<Record<string, string>>({});
  private readonly editedSource = signal<Record<string, string>>({});
  private readonly editingId = signal<string | null>(null);

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  isCreateBusy(): boolean {
    return this.busyAction() === 'create';
  }

  isBusy(action: 'update' | 'delete', id: string): boolean {
    return this.busyAction() === action && this.busyId() === id;
  }

  isEditing(id: string): boolean {
    return this.editingId() === id;
  }

  startEdit(entry: PushupRecord): void {
    this.editingId.set(entry._id);
    this.editedReps.update((prev) => ({ ...prev, [entry._id]: String(entry.reps) }));
    this.editedSource.update((prev) => ({ ...prev, [entry._id]: entry.source }));
  }

  cancelEdit(): void {
    this.editingId.set(null);
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
    this.editingId.set(null);
  }
}
