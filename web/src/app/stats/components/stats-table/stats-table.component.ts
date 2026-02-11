import { DatePipe } from '@angular/common';
import { AfterViewInit, Component, TemplateRef, ViewChild, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
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
    MatTableModule,
    MatSortModule,
    MatRippleModule,
  ],
  template: `
    <mat-card class="table-card">
      <div class="table-header">
        <h2>Einträge (CRUD)</h2>
        <div class="header-actions">
          <p>{{ entries().length }} Einträge</p>
          <button type="button" class="add-btn" mat-flat-button (click)="openCreateDialog()">
            <mat-icon>add</mat-icon>
            Neu
          </button>
        </div>
      </div>

      <div class="table-wrap">
        <mat-table
          [dataSource]="dataSource"
          matSort
          [matSortActive]="'timestamp'"
          [matSortDirection]="'desc'"
          class="mat-elevation-z8"
        >
          <ng-container matColumnDef="timestamp">
            <mat-header-cell *matHeaderCellDef mat-sort-header>Zeit</mat-header-cell>
            <mat-cell *matCellDef="let entry">{{ entry.timestamp | date: 'dd.MM.yyyy, HH:mm' }}</mat-cell>
          </ng-container>

          <ng-container matColumnDef="reps">
            <mat-header-cell *matHeaderCellDef mat-sort-header>Reps</mat-header-cell>
            <mat-cell *matCellDef="let entry">
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
            </mat-cell>
          </ng-container>

          <ng-container matColumnDef="source">
            <mat-header-cell *matHeaderCellDef mat-sort-header>Quelle</mat-header-cell>
            <mat-cell *matCellDef="let entry">
              @if (isEditing(entry._id)) {
                <input matInput type="text" [value]="editSource(entry)" (input)="setEditSource(entry, asValue($event))" />
              } @else {
                <span>{{ entry.source }}</span>
              }
            </mat-cell>
          </ng-container>

          <ng-container matColumnDef="actions">
            <mat-header-cell *matHeaderCellDef>Aktion</mat-header-cell>
            <mat-cell *matCellDef="let entry" class="actions">
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
            </mat-cell>
          </ng-container>

          <mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></mat-header-row>
          <mat-row matRipple *matRowDef="let row; columns: displayedColumns"></mat-row>
        </mat-table>

        @if (!entries().length) {
          <p class="empty">Keine Einträge im gewählten Zeitraum.</p>
        }
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
export class StatsTableComponent implements AfterViewInit {
  readonly dialog = inject(MatDialog);

  @ViewChild('createDialog') createDialog?: TemplateRef<unknown>;
  @ViewChild(MatSort) sort?: MatSort;

  readonly entries = input<PushupRecord[]>([]);
  readonly busyAction = input<'create' | 'update' | 'delete' | null>(null);
  readonly busyId = input<string | null>(null);

  readonly create = output<{ timestamp: string; reps: number; source?: string }>();
  readonly update = output<{ id: string; reps: number; source: string }>();
  readonly remove = output<string>();

  readonly newTimestamp = signal('');
  readonly newReps = signal('');
  readonly newSource = signal('web');

  readonly displayedColumns = ['timestamp', 'reps', 'source', 'actions'];
  readonly dataSource = new MatTableDataSource<PushupRecord>([]);

  private readonly editedReps = signal<Record<string, string>>({});
  private readonly editedSource = signal<Record<string, string>>({});
  private readonly editingId = signal<string | null>(null);

  constructor() {
    this.dataSource.sortingDataAccessor = (item, property) => {
      if (property === 'timestamp') return new Date(item.timestamp).getTime();
      if (property === 'reps') return item.reps;
      if (property === 'source') return item.source;
      return '';
    };

    effect(() => {
      this.dataSource.data = this.entries();
    });
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

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
