import { DatePipe } from '@angular/common';
import { Component, TemplateRef, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PushupRecord } from '@nx-temp/stats-models';

@Component({
  selector: 'app-stats-table',
  imports: [
    MatCardModule,
    MatProgressSpinnerModule,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  template: `
    <mat-card class="table-card">
      <div class="table-header">
        <h2>Einträge (CRUD)</h2>
        <div class="header-actions">
          <p>{{ sortedEntries().length }} Einträge</p>
          <button type="button" class="add-btn" mat-flat-button (click)="openCreateDialog()">
            <mat-icon>add</mat-icon>
            Neu
          </button>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <button type="button" class="sort-btn" mat-button (click)="setSort('timestamp')">
                  Zeit {{ sortIcon('timestamp') }}
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" mat-button (click)="setSort('reps')">
                  Reps {{ sortIcon('reps') }}
                </button>
              </th>
              <th>
                <button type="button" class="sort-btn" mat-button (click)="setSort('source')">
                  Quelle {{ sortIcon('source') }}
                </button>
              </th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of sortedEntries(); track entry._id) {
              <tr>
                <td>{{ entry.timestamp | date: 'dd.MM.yyyy, HH:mm' }}</td>
                <td>
                  @if (isEditing(entry._id)) {
                    <input
                      matInput
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
                    <input matInput type="text" [value]="editSource(entry)" (input)="setEditSource(entry, asValue($event))" />
                  } @else {
                    <span>{{ entry.source }}</span>
                  }
                </td>
                <td class="actions">
                  @if (isEditing(entry._id)) {
                    <button
                      type="button"
                      mat-icon-button
                      aria-label="Speichern"
                      title="Speichern"
                      [disabled]="isBusy('update', entry._id)"
                      (click)="save(entry)"
                    >
                      @if (isBusy('update', entry._id)) {
                        <mat-spinner diameter="14"></mat-spinner>
                      } @else {
                        <mat-icon>save</mat-icon>
                      }
                    </button>
                    <button
                      type="button"
                      mat-icon-button
                      aria-label="Abbrechen"
                      title="Abbrechen"
                      [disabled]="isBusy('update', entry._id)"
                      (click)="cancelEdit()"
                    >
                      <mat-icon>close</mat-icon>
                    </button>
                  } @else {
                    <button type="button" mat-icon-button aria-label="Edit" title="Edit" (click)="startEdit(entry)">
                      <mat-icon>edit</mat-icon>
                    </button>
                  }
                  <button
                    type="button"
                    class="danger"
                    mat-icon-button
                    aria-label="Löschen"
                    title="Löschen"
                    [disabled]="isBusy('delete', entry._id)"
                    (click)="remove.emit(entry._id)"
                  >
                    @if (isBusy('delete', entry._id)) {
                      <mat-spinner diameter="14"></mat-spinner>
                    } @else {
                      <mat-icon>delete</mat-icon>
                    }
                  </button>
                </td>
              </tr>
            }
            @if (!sortedEntries().length) {
              <tr>
                <td colspan="4" class="empty">Keine Einträge im gewählten Zeitraum.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </mat-card>

    <ng-template #createDialog>
      <div class="create-dialog">
        <h3>Neuen Eintrag anlegen</h3>

        <mat-form-field appearance="outline">
          <mat-label>Zeitpunkt</mat-label>
          <input matInput type="datetime-local" [value]="newTimestamp()" (input)="newTimestamp.set(asValue($event))" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Reps</mat-label>
          <input matInput type="number" min="1" [value]="newReps()" (input)="newReps.set(asValue($event))" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Quelle</mat-label>
          <input matInput type="text" [value]="newSource()" (input)="newSource.set(asValue($event))" />
        </mat-form-field>

        <div class="dialog-actions">
          <button type="button" mat-button (click)="dialog.closeAll()">Abbrechen</button>
          <button type="button" mat-flat-button [disabled]="isCreateBusy()" (click)="submitCreate()">
            @if (isCreateBusy()) {
              <mat-spinner diameter="14"></mat-spinner>
            } @else {
              Speichern
            }
          </button>
        </div>
      </div>
    </ng-template>
  `,
  styleUrl: './stats-table.component.scss',
})
export class StatsTableComponent {
  readonly dialog = inject(MatDialog);

  @ViewChild('createDialog') createDialog?: TemplateRef<unknown>;

  readonly entries = input<PushupRecord[]>([]);
  readonly busyAction = input<'create' | 'update' | 'delete' | null>(null);
  readonly busyId = input<string | null>(null);

  readonly create = output<{ timestamp: string; reps: number; source?: string }>();
  readonly update = output<{ id: string; reps: number; source: string }>();
  readonly remove = output<string>();

  readonly newTimestamp = signal('');
  readonly newReps = signal('');
  readonly newSource = signal('web');

  readonly sortBy = signal<'timestamp' | 'reps' | 'source'>('timestamp');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly sortedEntries = computed(() => {
    const rows = [...this.entries()];
    const by = this.sortBy();
    const dir = this.sortDir() === 'asc' ? 1 : -1;

    return rows.sort((a, b) => {
      if (by === 'timestamp') return a.timestamp.localeCompare(b.timestamp) * dir;
      if (by === 'reps') return (a.reps - b.reps) * dir;
      return a.source.localeCompare(b.source) * dir;
    });
  });

  private readonly editedReps = signal<Record<string, string>>({});
  private readonly editedSource = signal<Record<string, string>>({});
  private readonly editingId = signal<string | null>(null);

  openCreateDialog(): void {
    if (!this.createDialog) return;
    if (!this.newTimestamp()) {
      this.newTimestamp.set(this.defaultDateTimeLocal());
    }
    this.dialog.open(this.createDialog, { width: 'min(92vw, 420px)', maxWidth: '92vw' });
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  isCreateBusy(): boolean {
    return this.busyAction() === 'create';
  }

  isBusy(action: 'update' | 'delete', id: string): boolean {
    return this.busyAction() === action && this.busyId() === id;
  }

  setSort(column: 'timestamp' | 'reps' | 'source'): void {
    if (this.sortBy() === column) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortBy.set(column);
    this.sortDir.set('asc');
  }

  sortIcon(column: 'timestamp' | 'reps' | 'source'): string {
    if (this.sortBy() !== column) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
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

  submitCreate(): void {
    const reps = Number(this.newReps());
    if (!this.newTimestamp() || Number.isNaN(reps) || reps <= 0) return;

    this.create.emit({
      timestamp: this.newTimestamp(),
      reps,
      source: this.newSource() || 'web',
    });

    this.newReps.set('');
    this.dialog.closeAll();
  }

  private defaultDateTimeLocal(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
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
